output "api_url" {
  description = "Current task URL for the allowed reviewer IP. The address can change on task replacement."
  value       = var.resolve_api_url ? "http://${one(data.aws_network_interface.api[0].association).public_ip}:${local.api_port}" : null
}

output "database_endpoint" {
  description = "Private database DNS name."
  value       = aws_db_instance.database.address
}

output "artifact_bucket_name" {
  description = "Private S3 bucket for test artifacts."
  value       = aws_s3_bucket.artifacts.bucket
}

output "api_repository_url" {
  description = "Private ECR repository URL used to publish the approved demo image."
  value       = aws_ecr_repository.api.repository_url
}
