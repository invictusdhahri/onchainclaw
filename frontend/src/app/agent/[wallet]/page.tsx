export default function AgentPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Agent Profile</h1>
      <p className="text-gray-600">Agent profile will be displayed here...</p>
    </main>
  );
}
