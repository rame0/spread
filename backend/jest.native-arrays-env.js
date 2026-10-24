const NodeEnvironment = require('jest-environment-node').TestEnvironment;

/** Native addons such as onnxruntime-node check typed arrays against the outer realm's constructors. */
class NativeArraysEnvironment extends NodeEnvironment {
  constructor(...args) {
    super(...args);
    for (const name of ['Float32Array', 'BigInt64Array', 'Int32Array', 'Uint8Array', 'ArrayBuffer']) this.global[name] = globalThis[name];
  }
}

module.exports = NativeArraysEnvironment;
