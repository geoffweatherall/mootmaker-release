# The release pipeline's durable record of what actually happened, behind Decision 5's summary.
#
# Decision 5's GitHub Release answers "what happened, roughly" and links to Actions logs - but
# those age out at around 90 days, so the raw detail (Terraform's own output, the smoke tests'
# assertions) has no permanent home. This is that home.
#
# One group, not one per environment: a release spans test and production together, so splitting
# by environment would scatter a single release's story across two places. The `environment` field
# inside each event is what distinguishes them.
resource "aws_cloudwatch_log_group" "release_pipeline" {
  name              = "/mootmaker/release-pipeline"
  retention_in_days = var.log_retention_days

  tags = {
    Project   = "mootmaker"
    Component = "mootmaker-release"
    ManagedBy = "terraform"
  }
}

# Saved queries, so troubleshooting a release does not start with writing Logs Insights syntax
# from memory. Decision 11 names version/stage/component/outcome as the consistent fields that
# make this queryable rather than merely archived - these are what read them back.
#
# Deliberately Logs Insights QL rather than the OpenSearch SQL/PPL alternatives CloudWatch added in
# December 2024: QL is what the console defaults to, and a saved query nobody can read in the
# default mode is not much use.
resource "aws_cloudwatch_query_definition" "release_by_version" {
  name = "mootmaker/release - everything for one version"

  log_group_names = [aws_cloudwatch_log_group.release_pipeline.name]

  # The version is left as a placeholder rather than parameterised: Logs Insights has no query
  # parameters, so the intended use is to open this and edit the one obvious literal.
  query_string = <<-EOT
    fields @timestamp, stage, component, environment, outcome, @message
    | filter version = "0.0.0"
    | sort @timestamp asc
    | limit 1000
  EOT
}

resource "aws_cloudwatch_query_definition" "release_failures" {
  name = "mootmaker/release - failures across all releases"

  log_group_names = [aws_cloudwatch_log_group.release_pipeline.name]

  # The first question after a failed release is usually "has this stage failed before, and did it
  # look the same?" - which needs failures across versions, not within one.
  query_string = <<-EOT
    fields @timestamp, version, stage, component, environment, @message
    | filter outcome != "success"
    | sort @timestamp desc
    | limit 200
  EOT
}
