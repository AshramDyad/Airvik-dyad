'use client';

import Image from "@/components/ui/cloudflare-image";
import { useEffect, useMemo, useState } from 'react';

import { ShopFilters } from '@/components/marketing/shop/FiltersSheet';
import { ShopFiltersToolbar } from '@/components/marketing/shop/ShopFiltersToolbar';
import { createDefaultFilters } from '@/components/marketing/shop/filter-utils';
import { products } from '@/components/marketing/shop/products';
import { ProductCard } from '@/components/marketing/shop/ProductCard';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';


export default function ShopPage() {
  const [filters, setFilters] = useState<ShopFilters>(createDefaultFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('featured');

  const filteredProducts = useMemo(() => {
    const categoryFilter = filters.categories.includes('all')
      ? []
      : filters.categories;

    const withinFilters = products.filter((product) => {
      if (categoryFilter.length > 0 && !categoryFilter.includes(product.category)) {
        return false;
      }

      if (
        filters.attributes.length > 0 &&
        !filters.attributes.every((attribute) => product.attributes.includes(attribute))
      ) {
        return false;
      }

      const [min, max] = filters.priceRange;
      if (product.priceValue < min || product.priceValue > max) {
        return false;
      }

      return true;
    });

    const sorted = [...withinFilters];

    if (sortBy === 'price-asc') {
      sorted.sort((a, b) => a.priceValue - b.priceValue);
    } else if (sortBy === 'price-desc') {
      sorted.sort((a, b) => b.priceValue - a.priceValue);
    }

    return sorted;
  }, [filters, sortBy]);

  const itemsPerPage = 15;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [filteredProducts.length, currentPage, itemsPerPage]);

  return (
    <div className="overflow-x-hidden">
      <section className="relative overflow-hidden bg-muted">
        <div className="absolute inset-0">
          <Image
            src="/store.jpg"
            alt="Handpicked pieces for mindful living"
            fill
            priority
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10">
          <div className="container mx-auto flex flex-col items-center gap-4 px-4 py-24 text-center text-white md:px-6 md:py-32">
            <h1 className="max-w-3xl text-4xl font-serif font-semibold md:text-5xl">
              Sacred Essentials
            </h1>
            <p className="max-w-2xl text-base text-white/80 md:text-lg">
              Handmade malas, incense & books — offerings from our ashram to your home
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="container mx-auto space-y-10 px-4 md:px-6">
          <div className="flex flex-col gap-6">
            <ShopFiltersToolbar
              filters={filters}
              onFiltersChange={(nextFilters) => {
                setFilters(nextFilters);
                setCurrentPage(1);
              }}
              sortBy={sortBy}
              onSortChange={(nextSort) => {
                setSortBy(nextSort);
                setCurrentPage(1);
              }}
              createDefaultFilters={createDefaultFilters}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:gap-6 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
            {paginatedProducts.length > 0 ? (
              paginatedProducts.map(({ id, imageSrc, name, price, originalPrice, href }) => (
                <ProductCard
                  key={id}
                  imageSrc={imageSrc}
                  name={name}
                  price={price}
                  originalPrice={originalPrice}
                  // href={href}
                />
              ))
            ) : (
              <div className="col-span-2 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/30 py-12 text-center sm:col-span-2 md:col-span-4 xl:col-span-5">
                <p className="text-sm font-medium text-muted-foreground">No products match your filters.</p>
              </div>
            )}
          </div>

          {totalPages > 1 && paginatedProducts.length > 0 ? (
            <Pagination className="pt-4">
              <PaginationContent className="gap-2">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={currentPage === 1}
                    className={`rounded-xl border-0 px-4 py-2 text-sm hover:bg-primary/10 ${
                      currentPage === 1 ? 'pointer-events-none opacity-50' : ''
                    }`}
                    onClick={(event) => {
                      event.preventDefault();
                      if (currentPage > 1) {
                        setCurrentPage((prev) => prev - 1);
                      }
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      className="px-4 py-2"
                      isActive={page === currentPage}
                      onClick={(event) => {
                        event.preventDefault();
                        setCurrentPage(page);
                      }}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={currentPage === totalPages}
                    className={`rounded-xl border-0 px-4 py-2 text-sm hover:bg-primary/10 ${
                      currentPage === totalPages ? 'pointer-events-none opacity-50' : ''
                    }`}
                    onClick={(event) => {
                      event.preventDefault();
                      if (currentPage < totalPages) {
                        setCurrentPage((prev) => prev + 1);
                      }
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      </section>
    </div>
  );
}
