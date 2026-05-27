import { Panel } from "./Panel";

export function ResultPanel({ result }: { result: any }) {
  return (
    <Panel title="Result">
      <pre className="max-h-[560px] overflow-auto rounded-2xl border border-white/10 bg-black/60 p-4 text-xs leading-5 text-zinc-300">
        {JSON.stringify(result || {}, null, 2)}
      </pre>
    </Panel>
  );
}
