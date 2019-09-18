import IPFSFactory from 'ipfsd-ctl';

export default async function jestSetup() {
  const useBuiltIn = !process.env.IPFS_API_URL || !process.env.IPFS_GATEWAY_URL;
  if (!useBuiltIn) return;

  const ipfsServer: any = await new Promise((resolve, reject) => {
    IPFSFactory.create().spawn((err, ipfsd) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(ipfsd);
    });
  });

  process.env.IPFS_API_URL = `http://${ipfsServer.api.apiHost}:${ipfsServer.api.apiPort}`;
  process.env.IPFS_GATEWAY_URL = `http://${ipfsServer.api.gatewayHost}:${ipfsServer.api.gatewayPort}`;
  (global as any).ipfsServer = ipfsServer;
}