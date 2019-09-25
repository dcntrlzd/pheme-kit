import IPFSFactory from 'ipfsd-ctl';
import multiaddrToUri from 'multiaddr-to-uri';

export default async function jestSetup() {
  const useBuiltIn = !process.env.IPFS_API_URL || !process.env.IPFS_GATEWAY_URL;
  if (!useBuiltIn) return;

  const ipfsFactory = await IPFSFactory.create();
  const ipfsServer = await ipfsFactory.spawn();

  process.env.IPFS_API_URL = multiaddrToUri(ipfsServer.apiAddr);
  process.env.IPFS_GATEWAY_URL = multiaddrToUri(ipfsServer.gatewayAddr);

  (global as any).ipfsServer = ipfsServer;
}
