terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Bucket/key/region/locking are supplied via backend.hcl. No per-environment key: like
  # mootmaker-domain, this project takes no environment argument. There is exactly one release
  # pipeline and one log group it ships to, shared by every environment a release touches.
  backend "s3" {}
}
