package locks

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// req builds a request carrying an owner via the X-Lockstep-User header.
func req(method, target, owner, body string) *http.Request {
	r := httptest.NewRequest(method, target, bytes.NewReader([]byte(body)))
	if owner != "" {
		r.Header.Set("X-Lockstep-User", owner)
	}
	return r
}

func newHandler() *Handler { return NewHandler(NewMemStore()) }

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode: %v; body=%s", err, rec.Body.String())
	}
	return m
}

func TestCreateLock_Succeeds(t *testing.T) {
	h := newHandler()
	rec := httptest.NewRecorder()
	h.Create(rec, req(http.MethodPost, "/demo/locks", "jane", `{"path":"Content/Hero.uasset"}`))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	lock := decode(t, rec)["lock"].(map[string]any)
	if lock["path"] != "Content/Hero.uasset" {
		t.Fatalf("path = %v", lock["path"])
	}
	if lock["owner"].(map[string]any)["name"] != "jane" {
		t.Fatalf("owner = %v", lock["owner"])
	}
}

func TestCreateLock_ConflictWhenHeldByAnother(t *testing.T) {
	h := newHandler()
	h.Create(httptest.NewRecorder(), req(http.MethodPost, "/demo/locks", "jane", `{"path":"Content/Hero.uasset"}`))

	rec := httptest.NewRecorder()
	h.Create(rec, req(http.MethodPost, "/demo/locks", "bob", `{"path":"Content/Hero.uasset"}`))

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", rec.Code)
	}
	// The conflict reports the existing holder, not the requester.
	owner := decode(t, rec)["lock"].(map[string]any)["owner"].(map[string]any)["name"]
	if owner != "jane" {
		t.Fatalf("conflict owner = %v, want jane", owner)
	}
}

func TestVerify_SplitsOursAndTheirs(t *testing.T) {
	h := newHandler()
	h.Create(httptest.NewRecorder(), req(http.MethodPost, "/demo/locks", "jane", `{"path":"a.uasset"}`))
	h.Create(httptest.NewRecorder(), req(http.MethodPost, "/demo/locks", "bob", `{"path":"b.uasset"}`))

	rec := httptest.NewRecorder()
	h.Verify(rec, req(http.MethodPost, "/demo/locks/verify", "jane", `{}`))

	m := decode(t, rec)
	if got := len(m["ours"].([]any)); got != 1 {
		t.Fatalf("ours = %d, want 1", got)
	}
	if got := len(m["theirs"].([]any)); got != 1 {
		t.Fatalf("theirs = %d, want 1", got)
	}
}

func TestUnlock_OwnerSucceeds(t *testing.T) {
	h := newHandler()
	cr := httptest.NewRecorder()
	h.Create(cr, req(http.MethodPost, "/demo/locks", "jane", `{"path":"a.uasset"}`))
	id := decode(t, cr)["lock"].(map[string]any)["id"].(string)

	rec := httptest.NewRecorder()
	r := req(http.MethodPost, "/demo/locks/"+id+"/unlock", "jane", `{}`)
	r.SetPathValue("id", id)
	h.Unlock(rec, r)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
}

func TestUnlock_OtherUserForbiddenWithoutForce(t *testing.T) {
	h := newHandler()
	cr := httptest.NewRecorder()
	h.Create(cr, req(http.MethodPost, "/demo/locks", "jane", `{"path":"a.uasset"}`))
	id := decode(t, cr)["lock"].(map[string]any)["id"].(string)

	rec := httptest.NewRecorder()
	r := req(http.MethodPost, "/demo/locks/"+id+"/unlock", "bob", `{}`)
	r.SetPathValue("id", id)
	h.Unlock(rec, r)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestUnlock_OtherUserForceSucceeds(t *testing.T) {
	h := newHandler()
	cr := httptest.NewRecorder()
	h.Create(cr, req(http.MethodPost, "/demo/locks", "jane", `{"path":"a.uasset"}`))
	id := decode(t, cr)["lock"].(map[string]any)["id"].(string)

	rec := httptest.NewRecorder()
	r := req(http.MethodPost, "/demo/locks/"+id+"/unlock", "bob", `{"force":true}`)
	r.SetPathValue("id", id)
	h.Unlock(rec, r)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (admin force-unlock)", rec.Code)
	}
}
