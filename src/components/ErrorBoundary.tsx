import React from "react";

type ErrorBoundaryState = {

hasError: boolean;

message: string;

stack?: string;

};

export class ErrorBoundary extends React.Component<

{ children: React.ReactNode },

ErrorBoundaryState

> {

state: ErrorBoundaryState = {

hasError: false,

message: "",

stack: "",

};

static getDerivedStateFromError(error: Error): ErrorBoundaryState {

return {

hasError: true,

message: error.message || "Runtime error",

stack: error.stack,

};

}

componentDidCatch(error: Error) {

console.error("[AutoApp Runtime Error]", error);

}

handleReload = () => {

window.location.reload();

};

handleReset = () => {

this.setState({

hasError: false,

message: "",

stack: "",

});

};

render() {

if (!this.state.hasError) {

return this.props.children;

}

return (

<main className="min-h-screen bg-[#050505] px-4 py-8 text-white">

<section className="mx-auto max-w-2xl rounded-[2rem] border border-red-400/20 bg-red-500/5 p-5 shadow-2xl">

<div className="rounded-3xl border border-red-400/20 bg-black/40 p-5">

<p className="text-xs font-black uppercase tracking-[0.24em] text-red-200">

Runtime protection

</p>

<h1 className="mt-3 text-2xl font-black text-white">

AutoApp UI crashed safely

</h1>

<p className="mt-3 text-sm leading-6 text-zinc-400">

A component failed, but the app was prevented from going fully blank.

Use reset first. If the problem persists, reload.

</p>

<div className="mt-4 rounded-2xl border border-white/10 bg-black/50 p-4">

<p className="text-xs font-bold text-red-200">

{this.state.message}

</p>

</div>

<div className="mt-4 grid gap-2 sm:grid-cols-2">

<button

onClick={this.handleReset}

className="min-h-12 rounded-2xl bg-white px-4 text-sm font-black text-black active:scale-[0.98]"

>

Reset UI

</button>

<button

onClick={this.handleReload}

className="min-h-12 rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-black text-white active:scale-[0.98]"

>

Reload app

</button>

</div>

{this.state.stack ? (

<details className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">

<summary className="cursor-pointer text-xs font-bold text-zinc-400">

Technical stack

</summary>

<pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-zinc-500">

{this.state.stack}

</pre>

</details>

) : null}

</div>

</section>

</main>

);

}

}
