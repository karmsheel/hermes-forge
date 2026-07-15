-- Phase 6.1: black-box I/O shape on every process (default single-in single-out)
ALTER TABLE "Process" ADD COLUMN "ioShape" TEXT NOT NULL DEFAULT 'siso';
