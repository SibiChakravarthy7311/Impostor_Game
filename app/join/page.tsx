import { redirect } from "next/navigation";

export default async function JoinEntryPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const codeParam = params.code;
  const code = Array.isArray(codeParam) ? codeParam[0] : codeParam;

  if (code) {
    redirect(`/join/${code.toUpperCase()}`);
  }

  return (
    <section className="card space-y-4">
      <h1 className="text-2xl font-bold">Join Game</h1>
      <form action="/join" className="flex gap-2">
        <input name="code" className="rounded border border-slate-300 px-3 py-2 uppercase" required />
        <button className="rounded bg-slate-800 px-4 py-2 text-white" type="submit">Continue</button>
      </form>
    </section>
  );
}
