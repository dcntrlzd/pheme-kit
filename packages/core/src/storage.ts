import * as URL from 'url';
import IPFS from 'ipfs-http-client';
import axios from 'axios';

import { PROTOCOL_PATTERN } from './constants';
import { IPFSClient } from './types';

export const stripProtocol = (url: string) => {
  return url.replace(PROTOCOL_PATTERN, '');
};

export const getIPFSAddressFor = (address: string): string => {
  return stripProtocol(address);
};

export const buildIPFSInstaceFromUrl = (url: string): IPFSClient => {
  const uri = URL.parse(url);

  const protocol = (uri.protocol || 'http').replace(/:$/, '');
  const port = uri.port || (protocol === 'https' ? '443' : '80');
  return IPFS(uri.hostname, port, { protocol }) as IPFSClient;
};

export default class PhemeStorage {
  public readonly ipfs: IPFSClient;

  public readonly toWrite: IPFSClient;

  public readonly toRead: IPFSClient;

  public readonly gatewayUrl: string;

  private static CONTENT_FILENAME = 'content';

  private static ASSETS_DIRECTORY = 'assets';

  public constructor(apiUrl: string, gatewayUrl?: string) {
    this.gatewayUrl = gatewayUrl || apiUrl;

    this.toWrite = buildIPFSInstaceFromUrl(apiUrl);
    this.toRead = buildIPFSInstaceFromUrl(this.gatewayUrl);
  }

  public static addressForEstimation() {
    return 'qmv8ndh7ageh9b24zngaextmuhj7aiuw3scc8hkczvjkww/estimate.json';
  }

  public static serialize(input: any) {
    return JSON.stringify(input);
  }

  public static deserialize(input: string) {
    return JSON.parse(input);
  }

  public publicUrlFor(address: string) {
    if (!address) return '';

    const ipfsAddress = getIPFSAddressFor(address);
    return ipfsAddress ? `${this.gatewayUrl}/ipfs/${ipfsAddress}` : '';
  }

  public async read(address: string) {
    // https://github.com/axios/axios/issues/907
    // https://github.com/axios/axios/issues/1516
    const { data } = await axios.get(this.publicUrlFor(address), {
      responseType: 'text',
      transformResponse: undefined,
    });

    return Buffer.from(data);
  }

  public async write(data: any, onlyHash: boolean = false) {
    const [{ hash }] = await this.toWrite.add(data, { onlyHash, recursive: true });
    return hash;
  }

  public async readObject(address: string): Promise<any> {
    const data = await this.read(address);
    return PhemeStorage.deserialize(data.toString());
  }

  public async writeObject(object: any, onlyHash: boolean = false): Promise<string> {
    return this.write(Buffer.from(PhemeStorage.serialize(object)), onlyHash);
  }
}
