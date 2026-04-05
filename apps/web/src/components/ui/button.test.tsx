import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlertDialogFooter } from "./alert-dialog";
import { Button } from "./button";
import { DialogFooter } from "./dialog";

describe("button styling invariants", () => {
  it("uses dedicated readable foreground tokens for solid button variants", () => {
    const primaryHtml = renderToStaticMarkup(<Button>Commit</Button>);
    const destructiveHtml = renderToStaticMarkup(<Button variant="destructive">Delete</Button>);

    expect(primaryHtml).toContain("text-button-primary-foreground");
    expect(primaryHtml).not.toContain("text-primary-foreground");
    expect(destructiveHtml).toContain("text-button-destructive-foreground");
    expect(destructiveHtml).not.toContain("text-destructive-foreground");
  });

  it("keeps modal action buttons aligned in dialog footers", () => {
    const dialogHtml = renderToStaticMarkup(
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button>Continue</Button>
      </DialogFooter>,
    );
    const alertDialogHtml = renderToStaticMarkup(
      <AlertDialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button>Delete</Button>
      </AlertDialogFooter>,
    );

    expect(dialogHtml).toContain("[&amp;_[data-slot=button]]:w-full");
    expect(dialogHtml).toContain("sm:[&amp;_[data-slot=button]]:min-w-32");
    expect(alertDialogHtml).toContain("[&amp;_[data-slot=button]]:w-full");
    expect(alertDialogHtml).toContain("sm:[&amp;_[data-slot=button]]:min-w-32");
  });
});
