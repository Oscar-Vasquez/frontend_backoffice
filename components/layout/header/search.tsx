"use client";

import React from "react";
import { CommandIcon, SearchIcon, icons } from "lucide-react";
import { Input } from "@/components/ui/input";
import { page_routes } from "@/lib/routes-config";
import { useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type CommandItemProps = {
  item: {
    title: string;
    href: string;
    icon?: string;
  };
};

export default function Search() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const CommandItemComponent: React.FC<CommandItemProps> = ({ item }) => {
    // @ts-expect-error
    const LucideIcon = icons[item.icon];

    return (
      <CommandItem
        onSelect={() => {
          setOpen(false);
          router.push(item.href);
        }}>
        {item.icon && <LucideIcon className="me-2 !h-4 !w-4" />}
        <span>{item.title}</span>
      </CommandItem>
    );
  };

  return (
    <div className="ms-auto lg:me-auto lg:flex-1">
      <div className="relative hidden max-w-sm flex-1 lg:block">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" />
        <Input
          className="h-9 w-full cursor-pointer rounded-md border pl-10 pr-4 text-sm shadow-sm"
          placeholder="Buscar modulo..."
          type="search"
          onFocus={() => setOpen(true)}
        />
        <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-sm bg-zinc-200 p-1 font-mono text-xs font-medium dark:bg-neutral-700 sm:flex">
          <CommandIcon className="size-3" />
          <span>k</span>
        </div>
      </div>
      <div className="block lg:hidden">
        <Button size="sm" variant="link" onClick={() => setOpen(true)} className="text-foreground">
          <SearchIcon className="size-5" />
        </Button>
      </div>
      <CommandDialog 
        open={open} 
        onOpenChange={setOpen}
        className="command-dialog-fix z-[105]"
      >
        <CommandInput placeholder="Buscar modulos.." />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>No results found.</CommandEmpty>
          {page_routes.map((route) => (
            <React.Fragment key={route.title}>
              <CommandGroup heading={route.title}>
                {route.items.map((item, key) => (
                  <CommandItemComponent key={key} item={item} />
                ))}
              </CommandGroup>
              <CommandSeparator />
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
