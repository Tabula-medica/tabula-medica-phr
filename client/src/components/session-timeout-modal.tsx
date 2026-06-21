import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

interface SessionTimeoutModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export function SessionTimeoutModal({
  isOpen,
  secondsRemaining,
  onStayLoggedIn,
  onLogout,
}: SessionTimeoutModalProps) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, "0")}`
    : `${seconds}s`;

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent data-testid="modal-session-timeout">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2" data-testid="text-timeout-title">
            <Clock className="h-5 w-5 text-amber-500" />
            Session Expiring Soon
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Your session will expire in{" "}
              <span className="font-bold text-foreground" data-testid="text-timeout-countdown">
                {timeDisplay}
              </span>{" "}
              due to inactivity.
            </p>
            <p>
              For the security of your health records, you will be automatically
              logged out. Click "Stay Logged In" to continue your session.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={onLogout}
            className="gap-2"
            data-testid="button-timeout-logout"
          >
            <LogOut className="h-4 w-4" />
            Log Out Now
          </Button>
          <AlertDialogAction
            onClick={onStayLoggedIn}
            data-testid="button-timeout-stay"
          >
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
