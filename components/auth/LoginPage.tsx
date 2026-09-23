import Image from "next/image";

import { alexandria } from "@/lib/fonts";

import { EditorialLabel } from "./EditorialLabel";
import { LoginCard } from "./LoginCard";
import { LoginEditorial } from "./LoginEditorial";
import { LoginForm } from "./LoginForm";

const AUTH_CSS = `
.auth-input:-webkit-autofill,
.auth-input:-webkit-autofill:hover,
.auth-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #ffffff inset;
  -webkit-text-fill-color: #0a0a0a;
  caret-color: #0a0a0a;
}
`;

export function LoginPage() {
  return (
    <main
      className={`${alexandria.variable} ${alexandria.className} relative h-svh mmin-h-180 w-full overflow-hidden bg-[#F7F7F5] text-[#0A0A0A] antialiased selection:bg-[#E10600] selection:text-white max-lg:min-h-svh max-lg:overflow-y-auto`}
    >
      <style>{AUTH_CSS}</style>

      <Image
        src="/bg.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="z-0 object-cover object-center"
      />

      <div aria-hidden="true" className="absolute inset-0 z-1 bg-white/3" />

      <LoginEditorial />

      <EditorialLabel
        className="absolute bottom-11 left-13 z-10 hidden text-[12px] tracking-[0.33em] xl:flex"
        accent="vertical"
      >
        TECH BEYOND
        <br />
        THE ORDINARY
      </EditorialLabel>

      <EditorialLabel
        className="absolute right-13 top-11 z-10 hidden text-[13px] tracking-[0.44em] xl:flex"
        accent="vertical"
      >
        PEOPLE
        <br />
        IDEAS
        <br />
        IMPACT
      </EditorialLabel>

      <EditorialLabel
        className="absolute right-23 top-[34.2vh] z-10 hidden text-[12px] tracking-[0.36em] xl:flex"
      >
        SAME
        <br />
        VISION
        <br />
        BIGGER
        <br />
        IMPACT.
      </EditorialLabel>

      <EditorialLabel
        className="absolute bottom-12 right-14 z-10 hidden text-[12px] tracking-[0.33em] xl:flex"
        accent="vertical"
      >
        DESIGN
        <br />
        FROM
        <br />
        THE
        <br />
        SHADOW
      </EditorialLabel>

      <section className="absolute right-[clamp(120px,calc(33.75vw-356px),292px)] top-[clamp(88px,11.8vh,128px)] z-20 w-[clamp(500px,28.2vw,542px)] max-lg:relative max-lg:right-auto max-lg:top-auto max-lg:mx-auto max-lg:flex max-lg:min-h-svh max-lg:w-full max-lg:maax-w-140 max-lg:items-center max-lg:px-5 max-lg:py-10">
        <LoginCard>
          <LoginForm />
        </LoginCard>
      </section>
    </main>
  );
}
