export default async function jestTeardown() {
  const { ipfsServer } = (global as any);
  if (!ipfsServer) return;

  await new Promise(resolve => {
    ipfsServer.stop(resolve);
  })

  delete process.env.IPFS_API_URL;
  delete process.env.IPFS_GATEWAY_URL;
}
