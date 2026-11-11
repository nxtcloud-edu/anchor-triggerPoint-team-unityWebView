# Trigger_Point 데이터 버킷 (사격 원본 raw/ · 서버 상태 db/)
# 정적 웹사이트 호스팅과 web/ 공개 정책은 다음 단계에서 추가한다.
# 콘솔에서 버킷을 먼저 만들었다면 apply 전에 가져온다:
#   terraform import aws_s3_bucket.data anchor-edu-01-s3

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  description = "EC2(anchor-edu-01-ec2)와 같은 리전"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  type    = string
  default = "anchor-edu-01-s3"
}

resource "aws_s3_bucket" "data" {
  bucket = var.bucket_name

  tags = {
    Project = "trigger-point"
    Owner   = "anchor-edu-01"
  }
}

# 사격 데이터는 공개하지 않는다
resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# db/state.json 을 잘못 덮어써도 이전 버전으로 되돌릴 수 있게 한다
resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# db/state.json 의 지난 버전은 쌓이기만 한다. 정리가 필요해지면 (그리고 SafeRole 에
# s3:PutLifecycleConfiguration 권한이 있으면) noncurrent_version_expiration 규칙을 추가한다.

output "bucket" {
  value = aws_s3_bucket.data.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.data.arn
}
