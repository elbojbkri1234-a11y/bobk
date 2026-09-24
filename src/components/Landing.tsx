import type { FrameAsset } from "@/lib/frames";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollSequence } from "@/components/sequence/ScrollSequence";
import { Statement } from "@/components/sections/Statement";
import { Spaces } from "@/components/sections/Spaces";
import { Amenities } from "@/components/sections/Amenities";
import { Enquire } from "@/components/sections/Enquire";

type LandingProps = {
  frames: FrameAsset[];
};

export function Landing({ frames }: LandingProps) {
  return (
    <>
      <SiteNav />
      <main>
        <ScrollSequence frames={frames} />
        <Statement count={frames.length} />
        <Spaces frames={frames} />
        <Amenities />
        <Enquire />
      </main>
      <SiteFooter count={frames.length} />
    </>
  );
}
