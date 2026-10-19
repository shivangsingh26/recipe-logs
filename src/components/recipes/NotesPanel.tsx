import { ExternalLink } from "lucide-react";
import { Fragment } from "react";
import { Card } from "@/components/ui/Card";
import { parseBold, parseNotes, sourceHost, sourceUrl } from "@/lib/recipes/notes";
import type { Recipe } from "@/lib/types";
import { PanelEmpty } from "./PanelEmpty";

/** Notes & tips (paragraphs, bullets, **bold**) and the recipe's source. */
export function NotesPanel({ recipe }: { recipe: Recipe }) {
  const blocks = parseNotes(recipe.notes);
  const source = recipe.source.trim();
  if (blocks.length === 0 && !source) {
    return <PanelEmpty recipeId={recipe.id}>No notes yet. Add tips, tweaks or where the recipe came from.</PanelEmpty>;
  }

  return (
    <Card className="mt-2 px-4 py-4">
      {blocks.length > 0 && (
        <div className="space-y-3 text-base leading-relaxed text-ink">
          {blocks.map((block, i) =>
            block.type === "list" ? (
              <ul key={i} className="list-disc space-y-2 pl-5 marker:text-accent">
                {block.items.map((text, j) => (
                  <li key={j} className="pl-0.5">
                    <RichText text={text} />
                  </li>
                ))}
              </ul>
            ) : (
              <p key={i}>
                {block.lines.map((line, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    <RichText text={line} />
                  </Fragment>
                ))}
              </p>
            ),
          )}
        </div>
      )}
      {source && <SourceLine source={source} separated={blocks.length > 0} />}
    </Card>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {parseBold(text).map((span, i) =>
        span.bold ? (
          <strong key={i} className="font-semibold">
            {span.text}
          </strong>
        ) : (
          <Fragment key={i}>{span.text}</Fragment>
        ),
      )}
    </>
  );
}

function SourceLine({ source, separated }: { source: string; separated: boolean }) {
  const url = sourceUrl(source);
  return (
    <p className={separated ? "mt-4 border-t border-line pt-3 text-sm text-muted" : "text-sm text-muted"}>
      <span className="font-medium text-ink">Source: </span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 break-all font-medium text-accent underline-offset-2 hover:underline"
        >
          {sourceHost(url)}
          <ExternalLink aria-hidden className="size-3.5 shrink-0" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        source
      )}
    </p>
  );
}
