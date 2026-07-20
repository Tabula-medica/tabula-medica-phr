import { Link } from "wouter";
import { useAuthState } from "@/lib/auth";
import { BookOpen, User as UserIcon, Flame, Library, Music, LayoutGrid, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Navbar() {
  const { user, isSignedIn, isLoaded, signOut } = useAuthState();
  const displayName = user?.displayName ?? user?.email ?? "";
  const email = user?.email ?? "";
  const initial = (user?.displayName ?? user?.email ?? "U").charAt(0).toUpperCase();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-primary/10 p-1.5 rounded-full group-hover:bg-primary/20 transition-colors">
            <Flame className="h-5 w-5 text-primary" />
          </div>
          <span className="font-serif font-bold text-xl tracking-wide">NoorJyoti</span>
        </Link>

        <div className="flex items-center gap-6">
          {isSignedIn && (
            <>
              <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted-foreground">
                <Link href="/library" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <Library className="h-4 w-4" />
                  Library
                </Link>
                <Link href="/unity" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <LayoutGrid className="h-4 w-4" />
                  Unity Wall
                </Link>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={user?.photoURL ?? undefined} alt={displayName} />
                      <AvatarFallback className="bg-primary/10 text-primary">{initial}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card border-border" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                    <Link href="/me" className="flex items-center w-full">
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Profile & Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {isLoaded && !isSignedIn && (
            <div className="flex items-center gap-4">
              <Link href="/unity" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                Unity Wall
              </Link>
              <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Link>
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium h-9 px-4 rounded-full">
                <Link href="/sign-up">Begin Journey</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
