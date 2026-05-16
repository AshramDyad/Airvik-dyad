"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Pencil, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createCategoryIdOnly, updateCategoryWithoutReturning, deleteCategory } from "@/lib/api";
import { Category } from "@/data/types";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  parent_id: z.string().optional().nullable(),
  description: z.string().optional(),
});

const definedCategoryUpdate = (categoryData: Partial<Category>): Partial<Category> =>
  Object.fromEntries(
    Object.entries(categoryData).filter(([, value]) => typeof value !== "undefined")
  ) as Partial<Category>;

export function CategoriesManager({ initialCategories }: { initialCategories: Category[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filteredCategories, setFilteredCategories] = useState(categories);

  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      slug: "",
      parent_id: "none",
      description: "",
    },
  });

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    if (!search) {
      setFilteredCategories(categories);
    } else {
      setFilteredCategories(
        categories.filter((c) =>
          c.name.toLowerCase().includes(search.toLowerCase())
        )
      );
    }
  }, [search, categories]);

  // Slug generation
  const nameValue = form.watch("name");
  useEffect(() => {
    if (!editingId) {
      const slug = (nameValue || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      form.setValue("slug", slug);
    }
  }, [nameValue, editingId, form]);

  const onSubmit = async (values: z.infer<typeof categorySchema>) => {
    try {
      const payload = {
        ...values,
        parent_id: values.parent_id === "none" ? undefined : (values.parent_id || undefined),
      };

      if (editingId) {
        await updateCategoryWithoutReturning(editingId, payload);
        const updateForState = definedCategoryUpdate(payload);
        setCategories(categories.map(c => c.id === editingId ? { ...c, ...updateForState } : c));
        setEditingId(null);
      } else {
        const categoryId = await createCategoryIdOnly(payload);
        const created: Category = {
          id: categoryId,
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
          parent_id: payload.parent_id,
          created_at: new Date().toISOString(),
          _count: { posts: 0 },
        };
        setCategories([...categories, created]);
      }
      form.reset({
        name: "",
        slug: "",
        parent_id: "none",
        description: "",
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to save category:", error);
      alert("Failed to save category");
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    form.reset({
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id || "none",
      description: category.description || "",
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this category?")) {
        try {
            await deleteCategory(id);
            setCategories(categories.filter(c => c.id !== id));
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Failed to delete");
        }
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null);
    form.reset({
        name: "",
        slug: "",
        parent_id: "none",
        description: "",
      });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-24rem)]">
      {/* Left Side - Form */}
      <div className="w-full lg:w-[40%] space-y-6 bg-card p-6 rounded-lg border h-fit overflow-y-auto">
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
            {editingId ? "Edit Category" : "Add New Category"}
            </h2>
            {editingId && (
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
            )}
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Category Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="category-slug" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories
                        .filter((c) => c.id !== editingId) // Prevent self-parenting
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Category description..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              {editingId ? "Update Category" : "Add Category"}
            </Button>
          </form>
        </Form>
      </div>

      {/* Right Side - Table */}
      <div className="w-full lg:w-[60%] space-y-4 bg-card p-6 rounded-lg border h-full flex flex-col">
        <div className="flex gap-2">
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="secondary">Search</Button>
        </div>

        <div className="border rounded-md flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredCategories.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">No categories found.</TableCell>
                    </TableRow>
                ) : (
                    filteredCategories.map((category) => (
                        <TableRow key={category.id} className="group">
                        <TableCell className="font-medium">
                            {category.name}
                            {category.parent_id && (
                                <span className="text-muted-foreground text-xs block ml-2">
                                    ↳ parent: {categories.find(c => c.id === category.parent_id)?.name || "Unknown"}
                                </span>
                            )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={category.description}>
                            {category.description || "-"}
                        </TableCell>
                        <TableCell>{category.slug}</TableCell>
                        <TableCell className="text-right">{category._count?.posts || 0}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                             <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(category.id)}>
                                <Trash className="h-4 w-4" />
                            </Button>
                            </div>
                        </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
