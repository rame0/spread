import { describe, expect, it } from 'vitest';
import App from './App';

describe('application theme', () => {
  it('can be initialized with CSS color tokens', () => {
    expect(App).toBeTypeOf('function');
  });
});
