"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Category } from "@/data/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PostsFiltersProps = {
  categories: Category[];
  postCounts: {
    total: number;
    drafts: number;
  };
  activeStatus: "all" | "draft";
};

export function PostsFilters({
  categories,
  postCounts,
  activeStatus,
}: PostsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = searchParams ?? new URLSearchParams();
  
  const [search, setSearch] = useState(params.get("search") || "");
  const [category, setCategory] = useState(params.get("category") || "all");
  const [month, setMonth] = useState(params.get("month") || "all");
  const [status, setStatus] = useState<"all" | "draft">(activeStatus);

  useEffect(() => {
    setStatus(activeStatus);
  }, [activeStatus]);

  // Helper to generate last 12 months
  const baseDate = new Date();
  baseDate.setDate(1);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("default", { month: "long", year: "numeric" }),
    };
  });

  const navigateWithParams = (nextParams: URLSearchParams) => {
    const queryString = nextParams.toString();
    router.push(queryString ? `/admin/posts?${queryString}` : "/admin/posts");
  };

  const handleSearch = () => {
    const nextParams = new URLSearchParams();
    if (search) nextParams.set("search", search);
    if (category && category !== "all") nextParams.set("category", category);
    if (month && month !== "all") nextParams.set("month", month);
    if (status === "draft") nextParams.set("status", "draft");

    navigateWithParams(nextParams);
  };

  const handleStatusChange = (nextStatus: "all" | "draft") => {
    setStatus(nextStatus);
    const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
    if (nextStatus === "draft") {
      nextParams.set("status", "draft");
    } else {
      nextParams.delete("status");
    }

    if (search) nextParams.set("search", search);
    if (category && category !== "all") nextParams.set("category", category);
    else nextParams.delete("category");
    if (month && month !== "all") nextParams.set("month", month);
    else nextParams.delete("month");

    navigateWithParams(nextParams);
  };

  const handleTabValueChange = (value: string) => {
    if (value === "all" || value === "draft") {
      handleStatusChange(value);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <Tabs
        activityLabels={{ all: "All posts", draft: "Drafts" }}
        value={status}
        onValueChange={handleTabValueChange}
        className="w-full"
      >
        <TabsList className="justify-start gap-2">
          <TabsTrigger value="all" className="gap-2">
            All
            <span className="text-xs text-muted-foreground">
              ({postCounts.total})
            </span>
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-2">
            Drafts
            <span className="text-xs text-muted-foreground">
              ({postCounts.drafts})
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-4">
       <div className="w-[200px]">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger>
            <SelectValue placeholder="Select Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-[200px]">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Select Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 flex-1">
        <Input
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={handleSearch} variant="secondary">
          <Search className="mr-2 h-4 w-4" />
          Search Posts
        </Button>
      </div>
      </div>
    </div>
  );
}
