mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = {
      zone_ids = ["use1-az1", "use1-az3", "use1-az4"]
    }
  }
}

variables {
  aws_region    = "us-east-1"
  reviewer_cidr = "192.0.2.10/32"
  api_image_tag = "0000000000000000000000000000000000000000"
}

run "minimal_demo" {
  command = plan

  assert {
    condition = (
      aws_ecs_service.api.launch_type == "FARGATE" &&
      aws_ecs_service.api.desired_count == 1 &&
      aws_ecs_task_definition.api.cpu == "256" &&
      aws_ecs_task_definition.api.memory == "512"
    )
    error_message = "The demo should plan one task at the default Fargate size."
  }

  assert {
    condition = (
      alltrue([for subnet in aws_subnet.public : subnet.availability_zone_id != "use1-az3"]) &&
      aws_vpc_security_group_ingress_rule.reviewer.cidr_ipv4 == "192.0.2.10/32" &&
      aws_vpc_security_group_ingress_rule.reviewer.from_port == 3000 &&
      aws_vpc_security_group_ingress_rule.reviewer.to_port == 3000
    )
    error_message = "The demo should use ARM-compatible zones and allow HTTP only from the reviewer address."
  }

  assert {
    condition = (
      aws_db_instance.database.instance_class == "db.t4g.micro" &&
      aws_db_instance.database.publicly_accessible == false &&
      aws_db_instance.database.storage_encrypted == true &&
      aws_db_instance.database.manage_master_user_password == true &&
      aws_s3_bucket_public_access_block.artifacts.block_public_acls &&
      aws_s3_bucket_public_access_block.artifacts.ignore_public_acls &&
      aws_s3_bucket_public_access_block.artifacts.block_public_policy &&
      aws_s3_bucket_public_access_block.artifacts.restrict_public_buckets &&
      aws_ecr_repository.api.image_tag_mutability == "IMMUTABLE"
    )
    error_message = "The database and artifact storage should stay private and the image tag should stay immutable."
  }
}

run "rejects_public_ingress" {
  command = plan

  variables {
    reviewer_cidr = "0.0.0.0/0"
  }

  expect_failures = [var.reviewer_cidr]
}

run "skip_url_for_cleanup" {
  command = plan

  variables {
    resolve_api_url = false
  }

  assert {
    condition     = output.api_url == null && length(data.aws_network_interface.api) == 0
    error_message = "Cleanup must not require a running task or its address."
  }
}
