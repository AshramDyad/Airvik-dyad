import { SunilBhagatIntro } from "./sunil-bhagat-intro";
import { SunilBhagatProfileLoader } from "./sunil-bhagat-profile-loader";
import { SunilBhagatSectionsLoader } from "./sunil-bhagat-sections-loader";

export default function SunilBhagatPage() {
  return (
    <div className="bg-background text-foreground">
      <SunilBhagatIntro />
      <SunilBhagatProfileLoader />
      <SunilBhagatSectionsLoader />
    </div>
  );
}
