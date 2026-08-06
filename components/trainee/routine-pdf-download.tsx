"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Toast } from "@/components/ui/toast";
import type { RoutinePdfData } from "@/types/routine-pdf";

type RoutinePdfDownloadProps = {
  routine: RoutinePdfData;
};

type PdfImage = {
  dataUrl: string;
  width: number;
  height: number;
};

const PDF_COLORS = {
  background: [241, 243, 245] as const,
  surface: [226, 230, 234] as const,
  text: [11, 13, 16] as const,
  secondaryText: [89, 101, 117] as const,
  brand: [228, 199, 104] as const,
  border: [168, 176, 188] as const
};

function safeFileName(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${normalized || "sthenos-routine"}.pdf`;
}

function routineTypeLabel(routine: RoutinePdfData) {
  if (routine.routineType === "activity") return "Activity";
  if (routine.routineType === "gym") return "Gym workout";
  if (routine.routineType === "circuit") {
    return `${routine.defaultCycles} ${
      routine.defaultCycles === 1 ? "cycle" : "cycles"
    }`;
  }
  return "Individual workout";
}

async function loadPdfImage(source: string): Promise<PdfImage> {
  const response = await fetch(source);
  if (!response.ok) throw new Error("Unable to download routine image.");

  const objectUrl = URL.createObjectURL(await response.blob());

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Unable to decode routine image."));
      element.src = objectUrl;
    });
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const resolutionScale = Math.min(1, 1800 / Math.max(longestEdge, 1));
    const width = Math.max(1, Math.round(image.naturalWidth * resolutionScale));
    const height = Math.max(1, Math.round(image.naturalHeight * resolutionScale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) throw new Error("Unable to prepare routine image.");

    context.fillStyle = "rgb(241, 243, 245)";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.9),
      width: image.naturalWidth,
      height: image.naturalHeight
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function fitImage(
  image: Pick<PdfImage, "width" | "height">,
  maxWidth: number,
  maxHeight: number
) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return {
    width: image.width * scale,
    height: image.height * scale
  };
}

export function RoutinePdfDownload({ routine }: RoutinePdfDownloadProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: "success" | "error";
  }>({
    open: false,
    title: "",
    description: "",
    variant: "success"
  });

  async function downloadPdf() {
    setIsDownloading(true);
    setToast((current) => ({ ...current, open: false }));

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;
      let unavailableImageCount = 0;

      function paintPage() {
        pdf.setFillColor(...PDF_COLORS.background);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.setFillColor(...PDF_COLORS.brand);
        pdf.rect(0, 0, 5, pageHeight, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(...PDF_COLORS.text);
        pdf.text("STHENOS", margin, 13);
      }

      function addWrappedText(
        value: string,
        x: number,
        y: number,
        maxWidth: number,
        options?: {
          size?: number;
          color?: readonly [number, number, number];
          maxLines?: number;
        }
      ) {
        const size = options?.size ?? 10;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(size);
        pdf.setTextColor(...(options?.color ?? PDF_COLORS.secondaryText));
        const wrappedLines = pdf.splitTextToSize(value, maxWidth) as string[];
        const lines = options?.maxLines
          ? wrappedLines.slice(0, options.maxLines)
          : wrappedLines;

        if (options?.maxLines && wrappedLines.length > options.maxLines) {
          let lastLine = `${lines.at(-1) ?? ""}...`;
          while (lastLine.length > 3 && pdf.getTextWidth(lastLine) > maxWidth) {
            lastLine = `${lastLine.slice(0, -4).trimEnd()}...`;
          }
          lines[lines.length - 1] = lastLine;
        }

        pdf.text(lines, x, y);
        return y + lines.length * (size * 0.42);
      }

      async function addContainedImage(
        source: string | null,
        x: number,
        y: number,
        maxWidth: number,
        maxHeight: number,
        placeholderText?: string
      ) {
        if (!source && !placeholderText) return y;

        try {
          if (!source) throw new Error("No routine image provided.");
          const image = await loadPdfImage(source);
          const fitted = fitImage(image, maxWidth, maxHeight);
          pdf.addImage(
            image.dataUrl,
            "JPEG",
            x + (maxWidth - fitted.width) / 2,
            y + (maxHeight - fitted.height) / 2,
            fitted.width,
            fitted.height,
            undefined,
            "MEDIUM"
          );
        } catch {
          if (source) unavailableImageCount += 1;
          pdf.setDrawColor(...PDF_COLORS.border);
          pdf.setFillColor(...PDF_COLORS.surface);
          pdf.roundedRect(x, y, maxWidth, maxHeight, 3, 3, "FD");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(...PDF_COLORS.secondaryText);
          pdf.text(
            placeholderText ?? "Image unavailable in this offline copy",
            x + maxWidth / 2,
            y + maxHeight / 2,
            { align: "center", maxWidth: maxWidth - 6 }
          );
        }

        return y + maxHeight;
      }

      async function addExerciseSection(
        exercise: RoutinePdfData["exercises"][number],
        index: number,
        y: number,
        height: number
      ) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(...PDF_COLORS.secondaryText);
        pdf.text(`EXERCISE ${index + 1} OF ${routine.exercises.length}`, margin, y);

        const cardY = y + 5;
        const cardHeight = height - 5;
        pdf.setDrawColor(...PDF_COLORS.border);
        pdf.setFillColor(...PDF_COLORS.surface);
        pdf.roundedRect(margin, cardY, contentWidth, cardHeight, 3, 3, "FD");

        const inset = 6;
        const imageWidth = 58;
        const imageHeight = Math.min(66, cardHeight - inset * 2);
        const imageX = margin + inset;
        const imageY = cardY + inset;
        await addContainedImage(
          exercise.thumbnailUrl,
          imageX,
          imageY,
          imageWidth,
          imageHeight,
          "No exercise image"
        );

        const detailsX = imageX + imageWidth + 7;
        const detailsWidth = contentWidth - (detailsX - margin) - inset;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(...PDF_COLORS.text);
        const nameLines = (pdf.splitTextToSize(exercise.name, detailsWidth) as string[]).slice(
          0,
          2
        );
        pdf.text(nameLines, detailsX, imageY + 5);
        let detailsY = imageY + 7 + nameLines.length * 5;
        const metadata = [exercise.category, exercise.equipment]
          .filter(Boolean)
          .join(" - ");
        if (metadata) {
          detailsY = addWrappedText(metadata, detailsX, detailsY, detailsWidth, {
            size: 8,
            maxLines: 2
          });
        }
        detailsY += 4;

        const stats = [
          ...(routine.routineType === "gym"
            ? [{ label: "SETS", value: String(exercise.sets) }]
            : []),
          { label: "REPS", value: exercise.reps },
          {
            label: "REST",
            value: exercise.restSeconds ? `${exercise.restSeconds} sec` : "None"
          }
        ];
        const statsGap = 2;
        const statWidth =
          (detailsWidth - statsGap * (stats.length - 1)) / stats.length;

        stats.forEach((stat, statIndex) => {
          const statX = detailsX + statIndex * (statWidth + statsGap);
          pdf.setFillColor(...PDF_COLORS.background);
          pdf.roundedRect(statX, detailsY, statWidth, 16, 2, 2, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.5);
          pdf.setTextColor(...PDF_COLORS.secondaryText);
          pdf.text(stat.label, statX + statWidth / 2, detailsY + 5, {
            align: "center"
          });
          pdf.setFontSize(9);
          pdf.setTextColor(...PDF_COLORS.text);
          pdf.text(stat.value, statX + statWidth / 2, detailsY + 12, {
            align: "center",
            maxWidth: statWidth - 3
          });
        });

        if (exercise.notes) {
          const instructionsY = Math.max(imageY + imageHeight + 7, detailsY + 22);
          if (instructionsY < cardY + cardHeight - 7) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8);
            pdf.setTextColor(...PDF_COLORS.text);
            pdf.text("Instructions", imageX, instructionsY);
            addWrappedText(
              exercise.notes,
              imageX,
              instructionsY + 5,
              contentWidth - inset * 2,
              { size: 8, maxLines: 3 }
            );
          }
        }
      }

      paintPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...PDF_COLORS.secondaryText);
      pdf.text("ROUTINE PACK", margin, 27);
      pdf.setFontSize(25);
      pdf.setTextColor(...PDF_COLORS.text);
      const titleLines = pdf.splitTextToSize(routine.routineName, contentWidth) as string[];
      pdf.text(titleLines, margin, 41);
      let coverY = 41 + titleLines.length * 10;
      pdf.setFillColor(...PDF_COLORS.surface);
      pdf.roundedRect(margin, coverY, contentWidth, 18, 3, 3, "F");
      pdf.setFontSize(10);
      pdf.setTextColor(...PDF_COLORS.secondaryText);
      pdf.text("Prepared for", margin + 5, coverY + 7);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...PDF_COLORS.text);
      pdf.text(routine.traineeName, margin + 5, coverY + 13);
      pdf.text(routineTypeLabel(routine), pageWidth - margin - 5, coverY + 11, {
        align: "right"
      });
      coverY += 27;

      if (routine.routineType === "activity") {
        coverY = await addContainedImage(
          routine.thumbnailUrl,
          margin,
          coverY,
          contentWidth,
          105
        );
        coverY += 8;
      }

      if (routine.routineDescription) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(...PDF_COLORS.text);
        pdf.text("Overview", margin, coverY);
        coverY = addWrappedText(
          routine.routineDescription,
          margin,
          coverY + 6,
          contentWidth,
          { maxLines: routine.routineType === "activity" ? 4 : 3 }
        );
        coverY += 5;
      }

      if (routine.assignmentNotes) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(...PDF_COLORS.text);
        pdf.text("Coach note", margin, coverY);
        coverY = addWrappedText(
          routine.assignmentNotes,
          margin,
          coverY + 6,
          contentWidth,
          { maxLines: routine.routineType === "activity" ? 4 : 3 }
        );
        coverY += 5;
      }

      if (routine.exercises[0]) {
        const exerciseY = Math.max(coverY + 2, 116);
        const exerciseHeight = Math.min(138, pageHeight - 18 - exerciseY);
        await addExerciseSection(routine.exercises[0], 0, exerciseY, exerciseHeight);
      }

      const remainingExercises = routine.exercises.slice(1);
      const exercisePageTop = 25;
      const exercisePageBottom = pageHeight - 18;
      const exerciseGap = 7;
      const exerciseHeight =
        (exercisePageBottom - exercisePageTop - exerciseGap) / 2;

      for (let offset = 0; offset < remainingExercises.length; offset += 2) {
        pdf.addPage();
        paintPage();
        await addExerciseSection(
          remainingExercises[offset],
          offset + 1,
          exercisePageTop,
          exerciseHeight
        );
        const secondExercise = remainingExercises[offset + 1];
        if (secondExercise) {
          await addExerciseSection(
            secondExercise,
            offset + 2,
            exercisePageTop + exerciseHeight + exerciseGap,
            exerciseHeight
          );
        }
      }

      const pageCount = pdf.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        pdf.setPage(pageNumber);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...PDF_COLORS.secondaryText);
        pdf.text(
          `Sthenos | Page ${pageNumber} of ${pageCount}`,
          pageWidth - margin,
          pageHeight - 10,
          { align: "right" }
        );
      }

      pdf.setProperties({
        title: `${routine.routineName} - Sthenos Routine Pack`,
        subject: "Offline workout routine",
        author: "Sthenos"
      });
      const fileName = safeFileName(routine.routineName);
      await pdf.save(fileName, { returnPromise: true });

      setToast({
        open: true,
        title: "Routine PDF saved",
        description: unavailableImageCount
          ? `${fileName} was downloaded. ${unavailableImageCount} ${
              unavailableImageCount === 1 ? "image was" : "images were"
            } unavailable and replaced with a placeholder.`
          : `${fileName} is ready for offline use.`,
        variant: "success"
      });
    } catch {
      setToast({
        open: true,
        title: "PDF could not be created",
        description:
          "Check your connection so the routine images can load, then try again.",
        variant: "error"
      });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={isDownloading}
        onClick={downloadPdf}
      >
        {isDownloading ? (
          <Spinner className="h-4 w-4" label="Preparing routine PDF" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        {isDownloading ? "Preparing PDF..." : "Save PDF"}
      </Button>
      <Toast
        open={toast.open}
        onOpenChange={(open) => setToast((current) => ({ ...current, open }))}
        title={toast.title}
        description={toast.description}
        variant={toast.variant}
      />
    </>
  );
}
