import type { PostSourceQuery, SeoPriority } from "@/data/types";

export interface ParsedSeoDraftEntry {
  query: string;
  priority: SeoPriority;
  impressions: number;
  clicks: number;
  average_position: number;
  action: string;
  source_target_path: string;
  source_content: string;
}

export interface SeoDraftImportPayload {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  seo_title: string;
  meta_description: string;
  focus_keyword: string;
  target_keywords: string[];
  featured_image_alt: string;
  seo_notes: string;
  category_slug: string;
  source_query_data: PostSourceQuery[];
}

const readField = (section: string, field: string): string => {
  const pattern = new RegExp(`^\\*\\*${field}:\\*\\*\\s*(.+)$`, "m");
  return section.match(pattern)?.[1]?.trim() ?? "";
};

const readNumber = (value: string): number | null => {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const readPriority = (value: string): SeoPriority | null => {
  return value === "P1" || value === "P2" || value === "P3" ? value : null;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const inlineMarkdownToHtml = (value: string): string => {
  let html = escapeHtml(value);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
};

const bodyFromSection = (section: string): string => {
  const lines = section
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !/^\*\*(Priority|Impressions|Clicks|Avg position|Action|Target|SEO title|Meta):/.test(trimmed) &&
        !trimmed.startsWith("**Suggested internal links:") &&
        trimmed !== "---"
      );
    });

  const paragraphs: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length > 0) {
      paragraphs.push(current.join(" ").trim());
      current = [];
    }
  };

  for (const line of lines) {
    if (line.trim() === "") {
      flush();
    } else {
      current.push(line.trim());
    }
  }
  flush();

  return paragraphs
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${inlineMarkdownToHtml(paragraph)}</p>`)
    .join("\n");
};

export function parseSeoDraftMarkdown(markdown: string): ParsedSeoDraftEntry[] {
  const headingPattern = /^##\s+\d+\.\s+(.+)$/gm;
  const headings = Array.from(markdown.matchAll(headingPattern));

  return headings.map((heading, index) => {
    const start = heading.index ?? 0;
    const end = headings[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end);
    const query = heading[1].trim();
    const priority = readPriority(readField(section, "Priority"));
    const impressions = readNumber(readField(section, "Impressions"));
    const clicks = readNumber(readField(section, "Clicks"));
    const averagePosition = readNumber(readField(section, "Avg position"));
    const action = readField(section, "Action");
    const target = readField(section, "Target");

    if (!query || !priority || impressions === null || clicks === null || averagePosition === null || !action || !target) {
      throw new Error(`Incomplete SEO entry: ${query || `entry ${index + 1}`}`);
    }

    return {
      query,
      priority,
      impressions,
      clicks,
      average_position: averagePosition,
      action,
      source_target_path: target,
      source_content: bodyFromSection(section),
    };
  });
}

const categoryForQuery = (query: string): string => {
  const normalized = query.toLowerCase();
  if (
    /(free|cheap|price|cost|budget|food|5 star|affordable)/.test(normalized)
  ) {
    return "budget-community-meals";
  }
  if (
    /(near |muni ki reti|location|bus stand|ram jhula|triveni|laxman|janki|dharamshala list|ashram list)/.test(
      normalized,
    )
  ) {
    return "dharamshala-locations";
  }
  if (
    /(yoga|wellness|spiritual|ganga aarti|gurukul|peaceful|retreat)/.test(
      normalized,
    )
  ) {
    return "yoga-spiritual-life";
  }
  return "ashram-stays";
};

const MASTER_CONTENT: Record<string, Omit<SeoDraftImportPayload, "source_query_data" | "target_keywords">> = {
  "ashram-stays": {
    title: "Rishikesh Ashram Stay Guide: Rooms, Booking, Prices and Daily Life",
    slug: "rishikesh-ashram-stay-guide",
    excerpt:
      "A practical guide to planning an ashram stay in Rishikesh, including rooms, booking, meals, daily life and questions to confirm before you travel.",
    seo_title: "Rishikesh Ashram Stay Guide: Rooms, Booking & Daily Life",
    meta_description:
      "Planning a Rishikesh ashram stay? Compare rooms, booking, meals and daily life, then check current availability at Sahajanand Wellness.",
    focus_keyword: "rishikesh ashram stay",
    featured_image_alt: "Sahajanand Wellness ashram stay in Rishikesh",
    seo_notes:
      "Master guide created from the supplied 50-query Search Console content gap file. Confirm current room facilities, prices and schedules before publishing.",
    category_slug: "ashram-stays",
    content: `<p>A Rishikesh ashram stay is best planned around the experience you want: a simple place to stay, a spiritual daily rhythm, or a practical base near the Ganga. Sahajanand Wellness describes itself as an affordable ashram and dharamshala in Muni Ki Reti, with simple rooms and community-focused activities.</p>
<p><strong>Quick answer:</strong> Start with the official <a href="/book">booking page</a> for live availability, then use the <a href="/amenities">amenities page</a> to check what is currently included. Ask the ashram directly about room suitability, meals, accessibility and dates that are not covered online.</p>
<h2>What to check before booking an ashram stay</h2>
<ul><li>Room type, occupancy and bathroom arrangement.</li><li>Whether meals are included and where they are served.</li><li>How the daily spiritual routine fits your travel plans.</li><li>Cancellation, payment and identification requirements.</li><li>Access needs for children, older travellers or larger families.</li></ul>
<h2>What daily life may feel like</h2>
<p>An ashram is different from a resort because the atmosphere, shared spaces and community routines matter as much as the room. Sahajanand Wellness highlights yoga, meditation, Ganga Aarti, vegetarian meals, Vedic learning, gaushala and seva. Confirm which activities are available during your dates rather than assuming a fixed timetable.</p>
<h2>How to compare price and value</h2>
<p>Do not compare a room rate alone. Compare what is included, the room arrangement, meals, location, booking terms and the kind of daily environment you want. The current booking flow is the source of truth for live rates; the <a href="/about-us">About Us page</a> explains the ashram’s purpose and context.</p>
<h2>Questions families should ask</h2>
<p>Families should confirm occupancy, room placement, walking requirements, meal timing, quiet-hour expectations and access to essential facilities. If a requirement is important, contact the ashram before payment and keep the answer with your booking records.</p>
<h2>Frequently asked questions</h2>
<h3>Is an ashram stay in Rishikesh suitable for first-time visitors?</h3>
<p>It can be suitable when you understand the accommodation and community routines before booking. Read the current room and amenities information, choose a stay that matches your comfort needs, and contact the ashram when the website does not answer a practical question.</p>
<h3>Where can I check current Rishikesh ashram prices?</h3>
<p>Use the official booking flow for current availability and rates. Prices and room availability can change by date, occupancy and room type, so avoid relying on old screenshots, copied listings or fixed numbers in a general guide.</p>
<h2>Next step</h2>
<p>Review the <a href="/book">live booking options</a>, read the <a href="/about-rishikesh">Rishikesh travel guide</a>, and contact Sahajanand Wellness if your group has a specific room, accessibility or schedule requirement.</p>`,
  },
  "dharamshala-locations": {
    title: "Dharamshala and Ashram Locations in Rishikesh: A Practical Guide",
    slug: "rishikesh-dharamshala-location-guide",
    excerpt:
      "Compare Muni Ki Reti, Ganga-side, Ram Jhula and Triveni Ghat location questions before choosing a dharamshala or ashram in Rishikesh.",
    seo_title: "Dharamshala & Ashram Locations in Rishikesh: Practical Guide",
    meta_description:
      "Looking for a dharamshala in Rishikesh? Compare Muni Ki Reti, Ganga-side, Ram Jhula and Triveni Ghat location questions before booking.",
    focus_keyword: "dharamshala in rishikesh",
    featured_image_alt: "Ganga-side ashram and dharamshala area in Rishikesh",
    seo_notes:
      "Location guide created from the supplied query clusters. Verify live maps, routes, walking times and transport details before publishing.",
    category_slug: "dharamshala-locations",
    content: `<p>Choosing a dharamshala in Rishikesh is partly a location decision. The most useful question is not only “how close is it to a landmark?” but “does this location work for the places, transport and walking comfort that matter to my group?”</p>
<p><strong>Quick answer:</strong> Sahajanand Wellness is in Muni Ki Reti, near the Ganga and near Ram Jhula. Check the official address, map pin and current route conditions before booking, especially if you are travelling with older guests, children or luggage.</p>
<h2>Muni Ki Reti and the Ganga-side setting</h2>
<p>Muni Ki Reti is a practical base for visitors who want access to the Ganga and a quieter ashram environment. The site describes Sahajanand Wellness as an ashram and dharamshala in this area. Use the <a href="/about-rishikesh">Rishikesh guide</a> to plan the wider trip, then confirm the exact arrival route for your dates.</p>
<h2>Questions about Ram Jhula, Triveni Ghat and other landmarks</h2>
<p>Search phrases such as “near Ram Jhula,” “near Triveni Ghat,” “near Janki Setu” and “near Laxman Jhula” can describe different travel needs. A map distance does not tell you everything about bridges, traffic, stairs, route changes or evening transport. Compare the actual journey from the property to the places you will visit.</p>
<h2>How to shortlist a location</h2>
<ol><li>Save the official property pin.</li><li>Check the route from your arrival point.</li><li>List the two or three places your group will visit most.</li><li>Check walking, bridge and transport requirements.</li><li>Ask about drop-off, parking and late arrival arrangements.</li></ol>
<h2>Dharamshala versus hotel location expectations</h2>
<p>A dharamshala or ashram may be selected for simplicity, community atmosphere and practical value rather than resort-style services. Review the <a href="/amenities">current amenities</a> and confirm anything that affects your decision before payment.</p>
<h2>Frequently asked questions</h2>
<h3>Is Muni Ki Reti a good base for an ashram stay?</h3>
<p>Muni Ki Reti can suit visitors who want a Ganga-side ashram setting and access to Rishikesh’s spiritual and travel areas. The right choice depends on your route, mobility, transport plan and room needs, so check the exact property location rather than relying on a general area label.</p>
<h3>Should I choose a dharamshala only because it is near a landmark?</h3>
<p>No. Check the full route, not just the landmark name. A short map distance may still involve a bridge, stairs, traffic or walking that does not suit your group. Choose the location after confirming the practical journey and the accommodation itself.</p>
<h2>Next step</h2>
<p>Check the <a href="/book">official booking page</a>, save the property address and contact the ashram if your arrival route or accessibility needs are important.</p>`,
  },
  "budget-community-meals": {
    title: "Budget and Free Ashram Stays in Rishikesh: What to Check",
    slug: "budget-ashram-stay-rishikesh",
    excerpt:
      "Understand what free, cheap and budget ashram searches mean in Rishikesh, including room value, meals, donations and current booking terms.",
    seo_title: "Budget Ashram Stay in Rishikesh: Free, Cheap & Meal Questions",
    meta_description:
      "Searching for a cheap or free ashram stay in Rishikesh? Learn how to compare room value, meals, donations and current booking terms safely.",
    focus_keyword: "budget ashram stay Rishikesh",
    featured_image_alt: "Affordable ashram accommodation and community meal setting in Rishikesh",
    seo_notes:
      "Budget guide created from cost, free-stay, food and comfort queries. Never publish fixed rates or free-accommodation promises without current confirmation.",
    category_slug: "budget-community-meals",
    content: `<p>People searching for a free or cheap ashram stay in Rishikesh usually want to understand the total cost, not just a headline price. The useful comparison includes the room, meals, facilities, location, payment terms and whether a donation or contribution is expected.</p>
<p><strong>Quick answer:</strong> The current site presents Sahajanand Wellness as an affordable ashram and dharamshala, but live rates and availability should be checked through the official <a href="/book">booking flow</a>. Do not assume that every ashram offers free accommodation or that “free food” means the same thing everywhere.</p>
<h2>What “free stay” can mean</h2>
<p>“Free” may refer to a seva arrangement, a donation-supported service, a temporary programme or a community meal rather than a normal room booking. Ask what is included, who is eligible, how long the arrangement lasts and what rules apply. If the answer is not written in the official booking information, confirm it directly.</p>
<h2>How to compare affordable room value</h2>
<ul><li>Room type and occupancy.</li><li>Bathroom and cooling arrangements.</li><li>Meal inclusion and serving location.</li><li>Distance from your planned destinations.</li><li>Payment, cancellation and identification rules.</li></ul>
<p>The <a href="/amenities">amenities page</a> can help you understand the current offering. Avoid using old prices from search snippets or third-party listings as if they are current.</p>
<h2>Community meals and annakshetra questions</h2>
<p>Sahajanand Wellness describes vegetarian meals and community service among its offerings. Ask about current meal timing, inclusion, dietary needs and where meals are served. This is more useful than publishing an unverified promise about free food.</p>
<h2>What if you are looking for luxury?</h2>
<p>An ashram and a five-star resort are different types of stay. If your priority is luxury service, compare the actual facilities and service model rather than applying a hotel rating that the property does not claim. If your priority is affordability and a spiritual environment, read the ashram’s expectations carefully.</p>
<h2>Frequently asked questions</h2>
<h3>Does Sahajanand Wellness offer a general free stay?</h3>
<p>The current public information should be treated as the source of truth. It describes an affordable ashram and dharamshala, but visitors should check live room rates, availability, meal inclusion and any contribution expectations before assuming accommodation is free.</p>
<h3>How can I find the cheapest ashram stay in Rishikesh?</h3>
<p>Compare the total stay rather than searching for the lowest number. Check what the room includes, how meals work, where the property is located and which terms apply. Then use the official booking page or contact channel to confirm the current option for your dates.</p>
<h2>Next step</h2>
<p>Review the <a href="/book">current room options</a>, read <a href="/about-us">why the ashram operates</a>, and confirm cost and meal questions before payment.</p>`,
  },
  "yoga-spiritual-life": {
    title: "Yoga, Wellness and Spiritual Life in Rishikesh: Choosing an Ashram Experience",
    slug: "yoga-wellness-spiritual-rishikesh",
    excerpt:
      "Explore yoga, meditation, Ganga Aarti, Vedic learning and spiritual retreat expectations before choosing an ashram-based stay in Rishikesh.",
    seo_title: "Yoga, Wellness & Spiritual Life in Rishikesh: Ashram Guide",
    meta_description:
      "Planning a yoga or spiritual retreat in Rishikesh? Compare ashram routines, meditation, Ganga Aarti, Vedic learning and wellness expectations.",
    focus_keyword: "yoga ashram Rishikesh",
    featured_image_alt: "Yoga and spiritual life at an ashram in Rishikesh",
    seo_notes:
      "Spiritual-life guide created from yoga, wellness, retreat, Ganga Aarti, gurukul and peaceful-stay queries. Confirm current schedules before publishing.",
    category_slug: "yoga-spiritual-life",
    content: `<p>A yoga or spiritual retreat in Rishikesh is not defined only by the number of classes on a timetable. Visitors should understand the daily rhythm, the level of structure, the accommodation, the food, the community expectations and the activities that are actually available during their dates.</p>
<p><strong>Quick answer:</strong> Sahajanand Wellness describes yoga, meditation, daily Ganga Aarti, vegetarian meals, Vedic learning, gaushala and seva alongside simple accommodation. That makes it relevant to visitors seeking an ashram-based experience, while the <a href="/events">events page</a> and direct contact channel should be used to confirm current schedules.</p>
<h2>What to look for in a yoga ashram</h2>
<ul><li>Who the programme is designed for.</li><li>Whether participation is daily, optional or seasonal.</li><li>How much time is spent in practice versus independent travel.</li><li>What the room and meal arrangement includes.</li><li>Whether the atmosphere suits beginners, families or experienced practitioners.</li></ul>
<h2>Yoga, meditation and daily rhythm</h2>
<p>A peaceful stay often comes from choosing a compatible rhythm rather than expecting complete silence or a resort-style schedule. Ask which practices are currently running, what visitors should wear, whether advance registration is needed and how the activities fit around meals and travel.</p>
<h2>Ganga Aarti, Vedic learning and seva</h2>
<p>Ganga Aarti, Vedic learning, gaushala work and community seva each create a different kind of visitor experience. Read the <a href="/about-us">ashram background</a> and ask practical questions before treating a general description as a guaranteed daily programme.</p>
<h2>How to prepare for a spiritual stay</h2>
<ol><li>Read the current accommodation and amenities information.</li><li>Bring modest, comfortable clothing suitable for the setting.</li><li>Allow flexibility around community meals and activities.</li><li>Confirm any health, mobility, dietary or schedule requirements.</li><li>Keep time for rest and independent exploration of Rishikesh.</li></ol>
<h2>Frequently asked questions</h2>
<h3>Is an ashram stay the same as a yoga retreat?</h3>
<p>Not always. Some ashrams offer yoga or meditation as part of a wider spiritual and community environment, while a retreat may have a fixed course, teacher and schedule. Read the current programme details and ask what is included before booking.</p>
<h3>Can beginners visit a yoga ashram in Rishikesh?</h3>
<p>Many visitors begin with simple practices, but suitability depends on the programme and the visitor’s needs. Confirm the current level, participation requirements and daily routine, then choose an experience that feels practical and comfortable rather than relying on a generic label.</p>
<h2>Next step</h2>
<p>Review the <a href="/amenities">current facilities</a>, check <a href="/events">available events</a>, and contact Sahajanand Wellness about the spiritual activities available during your stay.</p>`,
  },
};

export function buildMasterDrafts(
  entries: ParsedSeoDraftEntry[],
): SeoDraftImportPayload[] {
  const grouped = new Map<string, PostSourceQuery[]>();

  for (const entry of entries) {
    const categorySlug = categoryForQuery(entry.query);
    const sourceEntry: PostSourceQuery = {
      query: entry.query,
      priority: entry.priority,
      impressions: entry.impressions,
      clicks: entry.clicks,
      average_position: entry.average_position,
      action: entry.action,
      source_target_path: entry.source_target_path,
    };
    const current = grouped.get(categorySlug) ?? [];
    current.push(sourceEntry);
    grouped.set(categorySlug, current);
  }

  return Object.entries(MASTER_CONTENT).map(([categorySlug, draft]) => {
    const sourceQueryData = grouped.get(categorySlug) ?? [];
    return {
      ...draft,
      target_keywords: sourceQueryData.map((entry) => entry.query),
      source_query_data: sourceQueryData,
    };
  });
}

export const SEO_MASTER_CATEGORY_SLUGS = Object.keys(MASTER_CONTENT);
