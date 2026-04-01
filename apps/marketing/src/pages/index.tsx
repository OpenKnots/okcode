import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>OK Code</title>
        <meta name="description" content="Starter placeholder for the OK Code marketing site." />
        <link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="/favicon-16x16.png" sizes="16x16" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>
      <main className="page">
        <section className="card">
          <p className="eyebrow">Create Next App</p>
          <h1>Basic starter page</h1>
          <p className="copy">
            Get started by editing <code>src/pages/index.tsx</code>.
          </p>
        </section>
      </main>
    </>
  );
}
