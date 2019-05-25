import { detectBlockVersion } from './index';

describe('detectBlockVersion', () => {
  it('should be able to detect v1 addresses', () => {
    const v1Address = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
    expect(detectBlockVersion(v1Address)).toBe('v1');
  });

  it('should be able to detect v2 addresses', () => {
    const v2Address = 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
    expect(detectBlockVersion(v2Address)).toBe('v2');
  });

  it('should be able to detect v3 addresses', () => {
    const v3Address = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/block.json';
    expect(detectBlockVersion(v3Address)).toBe('v3');
  });
});
