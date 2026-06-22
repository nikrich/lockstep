package locks

import (
	"encoding/json"
	"net/http"
	"time"
)

const contentType = "application/vnd.git-lfs+json"

// Handler serves the Git LFS File Locking API for a single Store.
type Handler struct {
	store Store
	now   func() time.Time
}

func NewHandler(s Store) *Handler {
	return &Handler{store: s, now: time.Now}
}

// --- wire types (Git LFS locking API shapes) ---

type ownerJSON struct {
	Name string `json:"name"`
}

type refJSON struct {
	Name string `json:"name"`
}

type lockJSON struct {
	ID       string    `json:"id"`
	Path     string    `json:"path"`
	LockedAt time.Time `json:"locked_at"`
	Owner    ownerJSON `json:"owner"`
}

func toJSON(l Lock) lockJSON {
	return lockJSON{ID: l.ID, Path: l.Path, LockedAt: l.LockedAt, Owner: ownerJSON{Name: l.Owner}}
}

func toJSONList(ls []Lock) []lockJSON {
	out := make([]lockJSON, 0, len(ls))
	for _, l := range ls {
		out = append(out, toJSON(l))
	}
	return out
}

// Create handles POST {lfs.url}/locks.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	owner := ownerFromRequest(r)
	var req struct {
		Path string  `json:"path"`
		Ref  refJSON `json:"ref"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Path == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}

	lock, created, err := h.store.Create(r.Context(), req.Path, req.Ref.Name, owner, h.now().UTC())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !created {
		// Already locked: LFS expects 409 with the conflicting lock.
		writeJSON(w, http.StatusConflict, map[string]any{
			"lock":    toJSON(lock),
			"message": "already locked",
		})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"lock": toJSON(lock)})
}

// List handles GET {lfs.url}/locks.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	ls, err := h.store.List(r.Context(), Filter{
		Path: q.Get("path"),
		ID:   q.Get("id"),
		Ref:  q.Get("refspec"),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"locks":       toJSONList(ls),
		"next_cursor": "",
	})
}

// Verify handles POST {lfs.url}/locks/verify — splits locks into the caller's
// own and everyone else's, so a client can refuse to push over others' locks.
func (h *Handler) Verify(w http.ResponseWriter, r *http.Request) {
	owner := ownerFromRequest(r)
	var req struct {
		Ref refJSON `json:"ref"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req) // body is optional

	ls, err := h.store.List(r.Context(), Filter{Ref: req.Ref.Name})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	ours := make([]lockJSON, 0)
	theirs := make([]lockJSON, 0)
	for _, l := range ls {
		if l.Owner == owner {
			ours = append(ours, toJSON(l))
		} else {
			theirs = append(theirs, toJSON(l))
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ours":        ours,
		"theirs":      theirs,
		"next_cursor": "",
	})
}

// Unlock handles POST {lfs.url}/locks/{id}/unlock.
func (h *Handler) Unlock(w http.ResponseWriter, r *http.Request) {
	owner := ownerFromRequest(r)
	id := r.PathValue("id")

	var req struct {
		Force bool    `json:"force"`
		Ref   refJSON `json:"ref"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	existing, found, err := h.store.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "lock not found")
		return
	}
	if existing.Owner != owner && !req.Force {
		writeError(w, http.StatusForbidden, "lock is owned by another user; retry with force")
		return
	}

	deleted, _, err := h.store.Delete(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"lock": toJSON(deleted)})
}

// ownerFromRequest resolves the acting user. Phase 1 placeholder: derive from
// Basic-Auth username or an explicit header. Real auth (tokens/teams) lands
// later in Phase 1 and will replace this.
func ownerFromRequest(r *http.Request) string {
	if u, _, ok := r.BasicAuth(); ok && u != "" {
		return u
	}
	if u := r.Header.Get("X-Lockstep-User"); u != "" {
		return u
	}
	return "anonymous"
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"message": msg})
}

// compile-time guard: MemStore satisfies Store.
var _ Store = (*MemStore)(nil)
