variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Region the release pipeline's log group lives in."
}

variable "log_retention_days" {
  type        = number
  default     = 120
  description = <<-EOT
    How long release-pipeline detail is kept. 120 days deliberately, not forever: permanence was
    never the goal - staying inside scale-to-zero was. The GitHub Release (Decision 5) is the
    permanent record; this is the detail behind it. Bump if 120 days ever proves too short in
    practice, which is a cost decision rather than a design one.
  EOT
}
