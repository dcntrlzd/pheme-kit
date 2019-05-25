export default async function jestTeardown() {
  const { ipfsServer } = (global as any);
  if (ipfsServer) {
    await new Promise(resolve => {
      ipfsServer.stop(resolve);
    })
  }
}
