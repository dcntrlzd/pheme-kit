export const PROTOCOL_PATTERN = /^[a-zA-Z0-9]+:\/\//;
export const IPFS_ADDRESS_PATTERN = /[1-9A-Za-z]{6,}/;

export const V3_CONTENT_ADDRESS = '/content';

export const V1_PATTERN = new RegExp(`^${IPFS_ADDRESS_PATTERN.source}$`);
export const V2_PATTERN = new RegExp(`${PROTOCOL_PATTERN.source}${IPFS_ADDRESS_PATTERN.source}$`);
export const V3_PATTERN = new RegExp(`^/content$`);
