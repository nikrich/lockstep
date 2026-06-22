package storage

import (
	"context"
	"fmt"
	"sync"
)

// MemStore is an in-memory Store for local development and tests. It tracks
// which oids "exist" and returns fake mem:// URLs; it moves no real bytes.
type MemStore struct {
	mu      sync.Mutex
	objects map[string]bool
}

func NewMemStore() *MemStore { return &MemStore{objects: map[string]bool{}} }

// Put marks an oid as present. Test/dev helper.
func (m *MemStore) Put(oid string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.objects[oid] = true
}

func (m *MemStore) Exists(_ context.Context, oid string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.objects[oid], nil
}

func (m *MemStore) PresignUpload(_ context.Context, oid string, _ int64) (*Link, error) {
	return &Link{Href: fmt.Sprintf("mem://upload/%s", oid), Header: map[string]string{}, ExpiresIn: 900}, nil
}

func (m *MemStore) PresignDownload(_ context.Context, oid string) (*Link, error) {
	return &Link{Href: fmt.Sprintf("mem://download/%s", oid), Header: map[string]string{}, ExpiresIn: 900}, nil
}
