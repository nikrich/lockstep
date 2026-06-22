// Package locks implements exclusive file locking — the feature that makes
// Lockstep viable for games. Binary assets (.uasset/.umap/.fbx) cannot be
// merged, so two concurrent editors means lost work. Locks enforce
// one-editor-at-a-time, exactly like Perforce.
//
// The wire protocol is the Git LFS File Locking API, so existing git clients
// and (Phase 2) the Unreal plugin speak it without bespoke code:
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/locking.md
package locks

import (
	"context"
	"sort"
	"strconv"
	"sync"
	"time"
)

// Lock is an exclusive claim on a single path, held by one owner.
type Lock struct {
	ID       string
	Path     string
	Ref      string // e.g. refs/heads/main (may be empty)
	Owner    string
	LockedAt time.Time
}

// Filter narrows a List query. Zero-value fields are ignored.
type Filter struct {
	Path string
	ID   string
	Ref  string
}

// Store persists locks. The in-memory implementation backs the spike; a
// Postgres implementation will back the hosted server (same interface).
type Store interface {
	// Create claims path for owner. If the path is already locked, it returns
	// the existing lock with created=false (the caller reports a 409).
	Create(ctx context.Context, path, ref, owner string, now time.Time) (lock Lock, created bool, err error)
	List(ctx context.Context, f Filter) ([]Lock, error)
	Get(ctx context.Context, id string) (Lock, bool, error)
	Delete(ctx context.Context, id string) (Lock, bool, error)
}

// MemStore is a goroutine-safe in-memory Store for the spike and tests.
type MemStore struct {
	mu      sync.Mutex
	byID    map[string]Lock
	byPath  map[string]string // path -> lock id (enforces one lock per path)
	counter int64
}

func NewMemStore() *MemStore {
	return &MemStore{byID: map[string]Lock{}, byPath: map[string]string{}}
}

func (m *MemStore) Create(_ context.Context, path, ref, owner string, now time.Time) (Lock, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if id, ok := m.byPath[path]; ok {
		return m.byID[id], false, nil // already locked by someone
	}

	m.counter++
	lock := Lock{
		ID:       strconv.FormatInt(m.counter, 10),
		Path:     path,
		Ref:      ref,
		Owner:    owner,
		LockedAt: now,
	}
	m.byID[lock.ID] = lock
	m.byPath[path] = lock.ID
	return lock, true, nil
}

func (m *MemStore) List(_ context.Context, f Filter) ([]Lock, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var out []Lock
	for _, l := range m.byID {
		if f.Path != "" && l.Path != f.Path {
			continue
		}
		if f.ID != "" && l.ID != f.ID {
			continue
		}
		if f.Ref != "" && l.Ref != "" && l.Ref != f.Ref {
			continue
		}
		out = append(out, l)
	}
	sort.Slice(out, func(i, j int) bool {
		a, _ := strconv.Atoi(out[i].ID)
		b, _ := strconv.Atoi(out[j].ID)
		return a < b
	})
	return out, nil
}

func (m *MemStore) Get(_ context.Context, id string) (Lock, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	l, ok := m.byID[id]
	return l, ok, nil
}

func (m *MemStore) Delete(_ context.Context, id string) (Lock, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	l, ok := m.byID[id]
	if !ok {
		return Lock{}, false, nil
	}
	delete(m.byID, id)
	delete(m.byPath, l.Path)
	return l, true, nil
}
