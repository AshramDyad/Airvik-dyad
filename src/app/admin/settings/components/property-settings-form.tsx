"use client";

import * as React from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useDataContext } from "@/context/data-context";
import { ImageUpload } from "@/components/shared/image-upload";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencyOptions, SUPPORTED_CURRENCIES } from "@/lib/currency";

const currencyEnumValues = SUPPORTED_CURRENCIES.map((currency) => currency.value) as [
  string,
  ...string[]
];

const propertySchema = z.object({
  name: z.string().min(1, "Property name is required."),
  address: z.string().min(1, "Address is required."),
  phone: z.string().min(1, "Phone number is required."),
  email: z.string().email("Please enter a valid email."),
  logo_url: z.string().optional(),
  photos: z.string().optional(),
  google_maps_url: z
    .string()
    .transform((v) => (v ?? "").trim())
    .refine(
      (v) => v === "" || z.string().url().safeParse(v).success,
      "Please enter a valid Google Maps embed URL."
    )
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  currency: z.enum(currencyEnumValues),
  tax_enabled: z.boolean(),
  tax_percentage: z.coerce
    .number({ invalid_type_error: "Enter a valid percentage" })
    .min(0, "Tax percentage cannot be negative")
    .max(100, "Tax percentage cannot exceed 100"),
  trust_registration_no: z.string().optional(),
  trust_date: z.string().optional(),
  pan_no: z.string().optional(),
  certificate_no: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.tax_enabled && data.tax_percentage <= 0) {
    ctx.addIssue({
      path: ["tax_percentage"],
      code: z.ZodIssueCode.custom,
      message: "Enter a percentage greater than 0 when taxes are enabled.",
    });
  }
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export function PropertySettingsForm() {
  const { property, updateProperty } = useDataContext();

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: property.name || "",
      address: property.address || "",
      phone: property.phone || "",
      email: property.email || "",
      logo_url: property.logo_url || "",
      photos: property.photos?.join(", ") || "",
      google_maps_url: property.google_maps_url || "",
      currency: property.currency || "INR",
      tax_enabled: property.tax_enabled ?? false,
      tax_percentage: (property.tax_percentage ?? 0) * 100,
      trust_registration_no: property.trust_registration_no || "",
      trust_date: property.trust_date || "",
      pan_no: property.pan_no || "",
      certificate_no: property.certificate_no || "",
    },
  });

  const google_maps_url = form.watch("google_maps_url");
  const taxEnabled = form.watch("tax_enabled");

  React.useEffect(() => {
    form.reset({
      name: property.name,
      address: property.address,
      phone: property.phone,
      email: property.email,
      logo_url: property.logo_url,
      photos: property.photos?.join(", ") || "",
      google_maps_url: property.google_maps_url,
      currency: property.currency || "INR",
      tax_enabled: property.tax_enabled ?? false,
      tax_percentage: (property.tax_percentage ?? 0) * 100,
      trust_registration_no: property.trust_registration_no || "",
      trust_date: property.trust_date || "",
      pan_no: property.pan_no || "",
      certificate_no: property.certificate_no || "",
    });
  }, [property, form]);

  const onSubmit: SubmitHandler<PropertyFormValues> = (values) => {
    const normalizedTaxPercentage = values.tax_enabled
      ? values.tax_percentage / 100
      : 0;
    const updatedData = {
      ...values,
      logo_url: values.logo_url || "",
      photos: values.photos ? values.photos.split(",").map(p => p.trim()).filter(Boolean) : [],
      google_maps_url: values.google_maps_url?.trim() || undefined,
      tax_percentage: normalizedTaxPercentage,
      trust_registration_no: values.trust_registration_no || undefined,
      trust_date: values.trust_date || undefined,
      pan_no: values.pan_no || undefined,
      certificate_no: values.certificate_no || undefined,
    };
    updateProperty(updatedData);
    toast.success("Property details updated successfully!");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Details</CardTitle>
        <CardDescription>
          Update your hotel&apos;s information. Changes will be saved
          immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-8"
          >
            <FormField<PropertyFormValues, "logo_url">
              control={form.control}
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo</FormLabel>
                  <FormControl>
                    <ImageUpload value={field.value || ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField<PropertyFormValues, "name">
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField<PropertyFormValues, "email">
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField<PropertyFormValues, "phone">
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField<PropertyFormValues, "address">
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField<PropertyFormValues, "currency">
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencyOptions.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the currency displayed across booking and admin experiences.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

          <div className="border rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Trust &amp; Legal Details</h3>
              <p className="text-sm text-muted-foreground">
                Manage legal registration details for donation receipts.
              </p>
            </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField<PropertyFormValues, "trust_registration_no">
                  control={form.control}
                  name="trust_registration_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trust Registration No.</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Registration number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField<PropertyFormValues, "trust_date">
                  control={form.control}
                  name="trust_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dtd.</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Date" />
                      </FormControl>
                      <FormDescription>Date of registration/trust deed</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField<PropertyFormValues, "pan_no">
                  control={form.control}
                  name="pan_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PAN No.</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Permanent Account Number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField<PropertyFormValues, "certificate_no">
                  control={form.control}
                  name="certificate_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certificate No.</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="80G Certificate Number" />
                      </FormControl>
                      <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
            <FormField<PropertyFormValues, "google_maps_url">
              control={form.control}
              name="google_maps_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google Maps Embed URL</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormDescription>
                    Go to Google Maps, find your location, click &quot;Share&quot;, then &quot;Embed a map&quot;, and copy the src URL.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {google_maps_url && (
              <div>
                <Label>Map Preview</Label>
                <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg border">
                  <iframe
                    src={google_maps_url}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
              </div>
            )}
            <FormField<PropertyFormValues, "photos">
              control={form.control}
              name="photos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Photos</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormDescription>
                    Add URLs to property photos, separated by commas.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="border rounded-lg p-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Taxes &amp; Fees</h3>
                <p className="text-sm text-muted-foreground">
                  Enable or disable taxes globally and set the percentage applied to bookings.
                </p>
              </div>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <FormField<PropertyFormValues, "tax_enabled">
                  control={form.control}
                  name="tax_enabled"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Enable taxes</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormDescription>
                        When enabled, the configured tax percentage is included in all pricing breakdowns.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField<PropertyFormValues, "tax_percentage">
                  control={form.control}
                  name="tax_percentage"
                  render={({ field }) => (
                    <FormItem className="w-full md:w-48 space-y-2">
                      <FormLabel>Tax percentage</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            disabled={!taxEnabled}
                            {...field}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </FormControl>
                      <FormDescription>Enter the rate to apply (e.g., 12 for 12%).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>



            <Button type="submit">Save Changes</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
