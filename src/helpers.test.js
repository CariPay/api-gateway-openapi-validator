const { comparePathToSpecPath } = require('./helpers');

test('Compares a key to path with 1 parameter', () => {
    const key = '/users/{uuid}';
    const path = '/users/d311f874-8585-4e5d-822a-8e052a74ba27';
    expect(comparePathToSpecPath(key, path)).toBe(true);
});

test('Compares a key to path with 2 parameters', () => {
    const key = '/users/{uuid}/items/{count}';
    const path = '/users/d311f874-8585-4e5d-822a-8e052a74ba27/items/1';
    expect(comparePathToSpecPath(key, path)).toBe(true);
});

test('Compares a key to path with 2 parameters back to back', () => {
    const key = '/users/{uuid}/{count}';
    const path = '/users/d311f874-8585-4e5d-822a-8e052a74ba27/1';
    expect(comparePathToSpecPath(key, path)).toBe(true);
});