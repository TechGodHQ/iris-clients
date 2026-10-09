test('URL constructor available in test env', () => {
  const u = new URL('https://iris.example.invalid');
  expect(u.protocol).toBe('https:');
  expect(u.hostname).toBe('iris.example.invalid');
});
