"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/admin/posts/rich-text-editor";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Category, Post } from "@/data/types";
import { createPost, updatePost, uploadFile } from "@/lib/api";
import { useAuthContext } from "@/context/auth-context";
import { Image as ImageIcon, Loader2, X } from "lucide-react";
import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";
import type { InternalLinkOption } from "@/lib/seo/internal-links";

const valuesForButton = (status: "draft" | "published", hasPost: boolean): string => {
  if (status === "published") {
    return hasPost ? "Update & Publish" : "Publish";
  }
  return hasPost ? "Update Draft" : "Save Draft";
};

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  featured_image: z.string().optional(),
  featured_image_alt: z.string().optional(),
  seo_title: z.string().optional(),
  meta_description: z.string().optional(),
  focus_keyword: z.string().optional(),
  target_keywords: z.string().optional(),
  seo_notes: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
  status: z.enum(["draft", "published"]),
}).superRefine((values, context) => {
  if (values.status !== "published") {
    return;
  }

  if (!values.content?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["content"], message: "Content is required before publishing" });
  }
  if (!values.seo_title?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["seo_title"], message: "SEO title is required before publishing" });
  }
  if (!values.meta_description?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["meta_description"], message: "Meta description is required before publishing" });
  }
  if (values.featured_image && !values.featured_image_alt?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["featured_image_alt"], message: "Add image alt text before publishing" });
  }
});

export function PostForm({
  post,
  categories,
  internalLinkOptions = [],
}: {
  post?: Post;
  categories: Category[];
  internalLinkOptions?: InternalLinkOption[];
}) {
  const router = useRouter();
  const { currentUser } = useAuthContext();
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const defaultCategoryIds = post?.categories?.map((c) => c.id) || [];

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: post?.title || "",
      slug: post?.slug || "",
      content: post?.content || "",
      excerpt: post?.excerpt || "",
      featured_image: post?.featured_image || "",
      featured_image_alt: post?.featured_image_alt || "",
      seo_title: post?.seo_title || "",
      meta_description: post?.meta_description || "",
      focus_keyword: post?.focus_keyword || "",
      target_keywords: post?.target_keywords?.join(", ") || "",
      seo_notes: post?.seo_notes || "",
      categoryIds: defaultCategoryIds,
      status: post?.status || "draft",
    },
  });

  // Auto-generate slug
  const titleValue = form.watch("title");
  const statusValue = form.watch("status");
  useEffect(() => {
    if (!post) {
      const slug = titleValue
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      form.setValue("slug", slug);
    }
  }, [titleValue, post, form]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadFile(file);
      form.setValue("featured_image", url);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Image upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof postSchema>) => {
    setIsSaving(true);
    try {
      const updatedValues = {
        ...values,
        content: values.content || "",
        target_keywords: values.target_keywords
          ?.split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean),
      };
      
      if (post) {
        await updatePost(post.id, updatedValues);
        router.push("/admin/posts");
        router.refresh();
      } else {
        if (!currentUser) {
            alert("You must be logged in to create a post.");
            setIsSaving(false);
            return;
        }
        await createPost({
            ...updatedValues,
            author_id: currentUser.id
        });
        router.push("/admin/posts");
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to save post:", error);
      alert("Failed to save post");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6 bg-card p-6 rounded-lg border">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Write your post content here..."
                    internalLinkOptions={internalLinkOptions}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="excerpt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Summary</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Short summary..."
                    className="h-24"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publish Status */}
          <div className="bg-card p-6 rounded-lg border space-y-4">
            <h3 className="font-semibold">Publish</h3>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-between pt-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {valuesForButton(statusValue, Boolean(post))}
              </Button>
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border space-y-4">
            <h3 className="font-semibold">Search preview</h3>
            <FormField
              control={form.control}
              name="seo_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SEO title</FormLabel>
                  <FormControl><Input placeholder="Search result title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="meta_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta description</FormLabel>
                  <FormControl><Textarea placeholder="Short, specific page summary" className="min-h-24" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="focus_keyword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Focus keyword</FormLabel>
                  <FormControl><Input placeholder="Main search phrase" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target_keywords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related keywords</FormLabel>
                  <FormControl><Textarea placeholder="Comma-separated related searches" className="min-h-24" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="seo_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SEO/source notes</FormLabel>
                  <FormControl><Textarea placeholder="Facts to verify before publishing" className="min-h-24" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {post?.source_query_data && post.source_query_data.length > 0 ? (
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Source query data ({post.source_query_data.length})
                </summary>
                <div className="mt-3 max-h-64 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 pr-2">Query</th>
                        <th className="py-2 pr-2">Priority</th>
                        <th className="py-2 pr-2">Impressions</th>
                        <th className="py-2">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {post.source_query_data.map((sourceQuery) => (
                        <tr key={`${sourceQuery.query}-${sourceQuery.source_target_path}`} className="border-b last:border-0">
                          <td className="py-2 pr-2">{sourceQuery.query}</td>
                          <td className="py-2 pr-2">{sourceQuery.priority}</td>
                          <td className="py-2 pr-2">{sourceQuery.impressions}</td>
                          <td className="py-2">{sourceQuery.average_position}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </div>

          {/* Categories */}
          <div className="bg-card p-6 rounded-lg border space-y-4">
            <h3 className="font-semibold">Categories</h3>
             <FormField
              control={form.control}
              name="categoryIds"
              render={({ field }) => (
                <FormItem>
                  <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-md p-2">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <Checkbox
                          checked={field.value?.includes(category.id)}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            if (checked) {
                              field.onChange([...current, category.id]);
                            } else {
                              field.onChange(current.filter((id) => id !== category.id));
                            }
                          }}
                        />
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {category.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Featured Image */}
          <div className="bg-card p-6 rounded-lg border space-y-4">
            <h3 className="font-semibold">Featured Image</h3>
            <FormField
                control={form.control}
                name="featured_image"
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <div className="space-y-4">
                                {field.value ? (
                                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                                        <Image
                                            src={field.value}
                                            alt="Featured"
                                            fill
                                            className="object-cover"
                                        />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute right-2 top-2"
                                            onClick={() => field.onChange("")}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                                        <ImageIcon className="h-8 w-8 text-muted-foreground mb-4" />
                                        <div className="text-sm text-muted-foreground">
                                            <label
                                                htmlFor="image-upload"
                                                className="relative cursor-pointer rounded-md bg-background font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:text-primary/80"
                                            >
                                                <span>Upload a file</span>
                                                <input
                                                    id="image-upload"
                                                    name="image-upload"
                                                    type="file"
                                                    className="sr-only"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    disabled={isUploading}
                                        />
                                            </label>
                                        </div>
                                        {isUploading && <p className="text-xs text-muted-foreground mt-2">Uploading...</p>}
                                    </div>
                                )}
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="featured_image_alt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image alt text</FormLabel>
                  <FormControl><Input placeholder="Describe the image" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* Slug */}
           <div className="bg-card p-6 rounded-lg border space-y-4">
            <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                    <Input {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
           </div>
        </div>
      </form>
    </Form>
  );
}
