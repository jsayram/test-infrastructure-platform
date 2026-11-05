resource "aws_db_subnet_group" "database" {
  name       = var.project_name
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "database" {
  identifier                  = "${var.project_name}-postgres"
  engine                      = "postgres"
  engine_version              = "17.11"
  engine_lifecycle_support    = "open-source-rds-extended-support-disabled"
  auto_minor_version_upgrade  = false
  instance_class              = var.db_instance_class
  allocated_storage           = 20
  storage_type                = "gp3"
  storage_encrypted           = true
  db_name                     = "test_platform"
  username                    = "db_admin"
  manage_master_user_password = true
  db_subnet_group_name        = aws_db_subnet_group.database.name
  vpc_security_group_ids      = [aws_security_group.database.id]
  publicly_accessible         = false
  multi_az                    = false
  backup_retention_period     = 0
  skip_final_snapshot         = true
  delete_automated_backups    = true
  deletion_protection         = false
}

resource "aws_s3_bucket" "artifacts" {
  bucket_prefix = "${var.project_name}-art-"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
