import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
  it('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to testing library matchers', () => {
    const element = document.createElement('div');
    element.textContent = 'Hello World';
    document.body.appendChild(element);
    expect(element).toBeInTheDocument();
  });
});
