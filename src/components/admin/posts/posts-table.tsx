"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Pencil, Trash, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Post } from "@/data/types";
import { deletePost } from "@/lib/api";
import { useRouter } from "next/navigation";

interface PostsTableProps {
  posts: Post[];
  showDraftBadge?: boolean;
}

export function PostsTable({ posts, showDraftBadge = true }: PostsTableProps) {
  const router = useRouter();

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this post?")) {
      try {
        await deletePost(id);
        router.refresh();
      } catch (error) {
        console.error("Failed to delete post:", error);
        alert("Failed to delete post");
      }
    }
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[400px]">Title</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Categories</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No posts found.
              </TableCell>
            </TableRow>
          ) : (
            posts.map((post) => (
              <TableRow key={post.id} className="group">
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{post.title}</span>
                      {showDraftBadge && post.status === "draft" ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          — Draft
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link
                        href={`/admin/posts/${post.id}`}
                        className="text-xs text-primary hover:underline flex items-center"
                      >
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Link>
                      <span className="text-muted-foreground">|</span>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="text-xs text-destructive hover:underline flex items-center"
                      >
                        <Trash className="mr-1 h-3 w-3" /> Trash
                      </button>
                      <span className="text-muted-foreground">|</span>
                      <Link
                        href={post.status === "draft" ? `/admin/posts/${post.id}/preview` : `/blog/${post.slug}`}
                        target="_blank"
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center"
                      >
                        <Eye className="mr-1 h-3 w-3" /> Preview
                      </Link>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {post.author?.full_name || "Unknown"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {post.categories?.map((cat) => (
                      <Badge key={cat.id} variant="outline" className="text-xs">
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-sm">
                    <span>{post.status === "published" ? "Published" : "Last Modified"}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(post.status === "published" ? (post.published_at || post.updated_at) : post.updated_at), "PPP")}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                   <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/posts/${post.id}`}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Link>
                   </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
