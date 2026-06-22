// Package lfs implements the Git LFS Batch API over a bring-your-own Store.
//
// Wire protocol reference:
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md
//
// The client POSTs the oids it wants to transfer; we reply with presigned
// URLs (the "basic" transfer adapter). The client then streams bytes directly
// to/from the object store — never through this server.
package lfs

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/lockstep-vcs/lockstep/server/storage"
)

const contentType = "application/vnd.git-lfs+json"

// Handler serves the Batch API for a single Store.
type Handler struct {
	store storage.Store
}

func NewHandler(s storage.Store) *Handler { return &Handler{store: s} }

type batchRequest struct {
	Operation string       `json:"operation"`
	Transfers []string     `json:"transfers"`
	Objects   []objectSpec `json:"objects"`
	HashAlgo  string       `json:"hash_algo"`
}

type objectSpec struct {
	Oid  string `json:"oid"`
	Size int64  `json:"size"`
}

type batchResponse struct {
	Transfer string           `json:"transfer"`
	Objects  []responseObject `json:"objects"`
	HashAlgo string           `json:"hash_algo,omitempty"`
}

type responseObject struct {
	Oid           string            `json:"oid"`
	Size          int64             `json:"size"`
	Authenticated bool              `json:"authenticated,omitempty"`
	Actions       map[string]action `json:"actions,omitempty"`
	Error         *objectError      `json:"error,omitempty"`
}

type action struct {
	Href      string            `json:"href"`
	Header    map[string]string `json:"header,omitempty"`
	ExpiresIn int               `json:"expires_in,omitempty"`
}

type objectError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Batch handles POST {lfs.url}/objects/batch.
func (h *Handler) Batch(w http.ResponseWriter, r *http.Request) {
	var req batchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	resp := batchResponse{Transfer: "basic", HashAlgo: "sha256"}
	for _, obj := range req.Objects {
		resp.Objects = append(resp.Objects, h.resolve(r.Context(), req.Operation, obj))
	}

	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *Handler) resolve(ctx context.Context, op string, obj objectSpec) responseObject {
	out := responseObject{Oid: obj.Oid, Size: obj.Size, Authenticated: true}

	switch op {
	case "upload":
		exists, err := h.store.Exists(ctx, obj.Oid)
		if err != nil {
			out.Error = &objectError{Code: http.StatusInternalServerError, Message: err.Error()}
			return out
		}
		if exists {
			return out // no actions => client already has it uploaded, skip
		}
		link, err := h.store.PresignUpload(ctx, obj.Oid, obj.Size)
		if err != nil {
			out.Error = &objectError{Code: http.StatusInternalServerError, Message: err.Error()}
			return out
		}
		out.Actions = map[string]action{"upload": toAction(link)}

	case "download":
		exists, err := h.store.Exists(ctx, obj.Oid)
		if err != nil {
			out.Error = &objectError{Code: http.StatusInternalServerError, Message: err.Error()}
			return out
		}
		if !exists {
			out.Error = &objectError{Code: http.StatusNotFound, Message: "object does not exist"}
			return out
		}
		link, err := h.store.PresignDownload(ctx, obj.Oid)
		if err != nil {
			out.Error = &objectError{Code: http.StatusInternalServerError, Message: err.Error()}
			return out
		}
		out.Actions = map[string]action{"download": toAction(link)}

	default:
		out.Error = &objectError{Code: http.StatusUnprocessableEntity, Message: "unsupported operation: " + op}
	}
	return out
}

func toAction(l *storage.Link) action {
	return action{Href: l.Href, Header: l.Header, ExpiresIn: l.ExpiresIn}
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": msg})
}
