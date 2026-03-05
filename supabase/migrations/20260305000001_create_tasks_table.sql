-- Task Management v1
-- Simple tasks: title, assignee, due date, complete/reopen
-- Linked to customer and/or work item

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  assigned_to_user_id UUID REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),
  work_item_id UUID REFERENCES work_items(id),
  created_by_user_id UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for the two main query paths
CREATE INDEX idx_tasks_work_item_id ON tasks(work_item_id);
CREATE INDEX idx_tasks_customer_id ON tasks(customer_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_user_id);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks" ON tasks
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create tasks" ON tasks
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update tasks" ON tasks
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Ops and admins can delete tasks" ON tasks
  FOR DELETE
  USING (get_user_role() IN ('admin', 'ops'));

-- updated_at trigger (function already exists)
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
