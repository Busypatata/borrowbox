-- Database-level protection against double booking.
-- Two APPROVED requests for the same item may never have overlapping inclusive date ranges.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "BorrowRequest"
  ADD CONSTRAINT "BorrowRequest_dates_valid" CHECK ("endDate" >= "startDate");

ALTER TABLE "BorrowRequest"
  ADD CONSTRAINT "BorrowRequest_no_overlapping_approved"
  EXCLUDE USING gist (
    "itemId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  ) WHERE ("status" = 'APPROVED');

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_no_self_review" CHECK ("reviewerId" <> "reviewedUserId");

ALTER TABLE "BorrowRequest"
  ADD CONSTRAINT "BorrowRequest_no_self_borrow" CHECK ("borrowerId" <> "ownerId");
