package lfs

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/lockstep-vcs/lockstep/server/storage"
)

func doBatch(t *testing.T, h *Handler, op string, objs []objectSpec) batchResponse {
	t.Helper()
	body, _ := json.Marshal(batchRequest{
		Operation: op,
		Transfers: []string{"basic"},
		Objects:   objs,
		HashAlgo:  "sha256",
	})
	req := httptest.NewRequest(http.MethodPost, "/demo/objects/batch", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.Batch(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != contentType {
		t.Fatalf("Content-Type = %q, want %q", ct, contentType)
	}
	var resp batchResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return resp
}

func TestUpload_NewObject_ReturnsUploadAction(t *testing.T) {
	h := NewHandler(storage.NewMemStore())
	resp := doBatch(t, h, "upload", []objectSpec{{Oid: "abcd1234", Size: 10}})

	obj := resp.Objects[0]
	if obj.Error != nil {
		t.Fatalf("unexpected error: %+v", obj.Error)
	}
	if _, ok := obj.Actions["upload"]; !ok {
		t.Fatalf("expected an upload action, got %+v", obj.Actions)
	}
}

func TestUpload_ExistingObject_SkipsTransfer(t *testing.T) {
	mem := storage.NewMemStore()
	mem.Put("abcd1234")
	h := NewHandler(mem)

	resp := doBatch(t, h, "upload", []objectSpec{{Oid: "abcd1234", Size: 10}})

	// No actions => git-lfs treats the object as already uploaded.
	if n := len(resp.Objects[0].Actions); n != 0 {
		t.Fatalf("expected 0 actions for existing object, got %d", n)
	}
}

func TestDownload_Existing_ReturnsDownloadAction(t *testing.T) {
	mem := storage.NewMemStore()
	mem.Put("abcd1234")
	h := NewHandler(mem)

	resp := doBatch(t, h, "download", []objectSpec{{Oid: "abcd1234", Size: 10}})

	if _, ok := resp.Objects[0].Actions["download"]; !ok {
		t.Fatalf("expected a download action, got %+v", resp.Objects[0].Actions)
	}
}

func TestDownload_Missing_Returns404(t *testing.T) {
	h := NewHandler(storage.NewMemStore())
	resp := doBatch(t, h, "download", []objectSpec{{Oid: "missing", Size: 10}})

	err := resp.Objects[0].Error
	if err == nil || err.Code != http.StatusNotFound {
		t.Fatalf("expected 404 error, got %+v", err)
	}
}

func TestBatch_TransferAndHashEchoed(t *testing.T) {
	h := NewHandler(storage.NewMemStore())
	resp := doBatch(t, h, "upload", []objectSpec{{Oid: "abcd1234", Size: 1}})

	if resp.Transfer != "basic" {
		t.Fatalf("transfer = %q, want basic", resp.Transfer)
	}
	if resp.HashAlgo != "sha256" {
		t.Fatalf("hash_algo = %q, want sha256", resp.HashAlgo)
	}
}
