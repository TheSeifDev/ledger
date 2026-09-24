import { EditorialLabel } from "./EditorialLabel";

export function LoginEditorial() {
  return (
    <section
      className="absolute left-[clamp(170px,16.9vw,325px)] top-[clamp(118px,13.8vh,150px)] z-10 hidden w-[clamp(420px,31vw,600px)] lg:block"
      aria-label="PHANTOMS Ledger editorial introduction"
    >
      <div
        aria-hidden="true"
        className="absolute -left-[clamp(90px,7.8vw,150px)] top-18 flex flex-col items-center text-[18px] font-medium leading-none text-[#0A0A0A]"
      >
        <span>01</span>
        <span className="mt-4.5 h-0.75 w-3.5 bg-[#E10600]" />
        <span className="mt-5.5">/</span>
        <span className="mt-5.5">03</span>
      </div>

      <h1 className="text-[clamp(78px,5.95vw,114px)] font-black leading-[0.83] tracking-[-0.035em] text-[#0A0A0A]">
        <span className="block">Turn</span>
        <span className="block text-[#E10600]">Ideas</span>
        <span className="block">into</span>
        <span className="block">Impact.</span>
      </h1>

      <p className="mt-7.5 text-[clamp(16px,1.05vw,20px)] font-medium uppercase tracking-[0.34em] text-[#0A0A0A]">
        Track <span className="mx-5">·</span> Manage <span className="mx-5">·</span> Grow
      </p>

      <EditorialLabel className="mt-12" accent="horizontal">
        BUILT
        <br />
        FOR
        <br />
        BIGGER
        <br />
        IDEAS.
      </EditorialLabel>
    </section>
  );
}
