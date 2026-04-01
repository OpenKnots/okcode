import { HeartIcon, PlusIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useAppSettings } from "../appSettings";
import { cn } from "../lib/utils";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "./ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { SidebarMenuButton } from "./ui/sidebar";

const MAX_FAVORITES = 64;
const MAX_FAVORITE_LENGTH = 256;

function normalizeFavorite(raw: string): string {
  return raw.trim().slice(0, MAX_FAVORITE_LENGTH);
}

export function FavesDropdown() {
  const { settings, updateSettings } = useAppSettings();
  const favorites = settings.favorites;
  const [isAdding, setIsAdding] = useState(false);
  const [newFav, setNewFav] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addFavorite = useCallback(
    (raw: string) => {
      const value = normalizeFavorite(raw);
      if (!value) return;
      if (favorites.includes(value)) return;
      if (favorites.length >= MAX_FAVORITES) return;
      updateSettings({ favorites: [...favorites, value] });
      setNewFav("");
      setIsAdding(false);
    },
    [favorites, updateSettings],
  );

  const removeFavorite = useCallback(
    (value: string) => {
      updateSettings({ favorites: favorites.filter((f) => f !== value) });
    },
    [favorites, updateSettings],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        addFavorite(newFav);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setIsAdding(false);
        setNewFav("");
      }
    },
    [addFavorite, newFav],
  );

  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <SidebarMenuButton
                  size="sm"
                  className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                />
              }
            >
              <HeartIcon className="size-3.5" />
              <span className="text-xs">Faves</span>
              {favorites.length > 0 && (
                <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/50">
                  {favorites.length}
                </span>
              )}
            </MenuTrigger>
          }
        />
        <TooltipPopup side="right">Your favorites</TooltipPopup>
      </Tooltip>

      <MenuPopup side="top" align="start" sideOffset={8} className="min-w-56 max-w-72">
        <MenuGroup>
          <MenuGroupLabel>Faves</MenuGroupLabel>
          {favorites.length === 0 && !isAdding && (
            <div className="px-3 py-2 text-xs text-muted-foreground/60">
              No favorites yet. Click + to add one.
            </div>
          )}
          {favorites.map((fav) => (
            <MenuItem
              key={fav}
              className="group/fav-item justify-between gap-2"
              closeOnClick={false}
            >
              <span className="min-w-0 truncate text-xs">{fav}</span>
              <button
                type="button"
                aria-label={`Remove "${fav}" from favorites`}
                className="invisible shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive-foreground group-hover/fav-item:visible"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeFavorite(fav);
                }}
              >
                <XIcon className="size-3" />
              </button>
            </MenuItem>
          ))}
        </MenuGroup>

        <MenuSeparator />

        {isAdding ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <input
              ref={inputRef}
              className="min-w-0 flex-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-ring focus:ring-1 focus:ring-ring/20"
              placeholder="Add a favorite..."
              value={newFav}
              onChange={(event) => setNewFav(event.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={MAX_FAVORITE_LENGTH}
            />
            <button
              type="button"
              className={cn(
                "shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150",
                newFav.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
              disabled={!newFav.trim()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                addFavorite(newFav);
              }}
            >
              Add
            </button>
          </div>
        ) : (
          <MenuItem
            className="gap-2 text-muted-foreground"
            closeOnClick={false}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsAdding(true);
              queueMicrotask(() => inputRef.current?.focus());
            }}
          >
            <PlusIcon className="size-3.5" />
            <span className="text-xs">Add favorite</span>
          </MenuItem>
        )}
      </MenuPopup>
    </Menu>
  );
}
