output "log_group_name" {
  value       = aws_cloudwatch_log_group.release_pipeline.name
  description = "Log group the release pipeline ships structured stage output to."
}
