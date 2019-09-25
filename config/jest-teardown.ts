export default async function jestTeardown() {
  const { ipfsServer } = (global as any);
  if (!ipfsServer) return;

  await ipfsServer.stop();

  delete process.env.IPFS_API_URL;
  delete process.env.IPFS_GATEWAY_URL;
}
